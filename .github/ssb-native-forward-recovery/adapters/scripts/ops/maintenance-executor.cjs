'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { MaintenanceState, MaintenanceDenied } = require('../../apps/api/dist/maintenance/maintenance-state');
const startContract = require('./maintenance-start-contract.cjs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function withDescriptor(fd, action) {
  let primary;
  try { return action(); }
  catch (error) { primary = error; throw error; }
  finally {
    try { fs.closeSync(fd); }
    catch (cleanup) {
      if (primary !== undefined) throw new AggregateError([primary, cleanup], 'Secret I/O and descriptor cleanup failed');
      throw cleanup;
    }
  }
}

// No default production target, shell command, timeout extension, unlock, or auto-retry.
class MaintenanceExecutor {
  constructor(binding) { this.state = new MaintenanceState(binding); }

  async mutate(owner, epoch, kind, action) {
    if (!['deployment', 'configuration'].includes(kind)) throw new MaintenanceDenied('operation_not_allowed');
    this.state.drained(owner, epoch);
    const id = this.state.begin(kind, undefined, owner, epoch);
    let result;
    try {
      this.state.assertEpoch(owner, epoch);
      result = await action();
    } catch (primary) {
      try { this.state.end(id, true); }
      catch (cleanup) { throw new AggregateError([primary, cleanup], 'Mutation and completion verification failed'); }
      throw primary;
    }
    // Publish the actual successful effect before fallible, owner/epoch-bound accounting.
    // Accounting failure is not an unknown action outcome and must not replay the action.
    this.state.end(id, false, owner, epoch);
    return result;
  }

  async replaceSecretField(owner, epoch, file, expectedHash, value) {
    return this.mutate(owner, epoch, 'configuration', () =>
      replacePrivateSecret(file, expectedHash, value, () => this.state.assertEpoch(owner, epoch)));
  }

  async composeApi(owner, epoch, contract, execute = promisify(execFile)) {
    startContract.assertPlan(this.state.binding, contract);
    this.state.assertDeployment(owner, epoch, contract.previousGeneration, contract.bootstrap);
    return this.mutate(owner, epoch, 'deployment', () =>
      composeParticipant(this.state.binding, contract, () => this.state.assertDeployment(owner, epoch, contract.previousGeneration, contract.bootstrap), execute));
  }

}

async function replacePrivateSecret(file, expectedHash, value, check) {
    if (!path.isAbsolute(file) || typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new MaintenanceDenied('invalid_secret_input');
    }
      await check();
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid()) {
        throw new MaintenanceDenied('config_not_private');
      }
      const before = fs.readFileSync(file);
      if (hash(before) !== expectedHash) throw new MaintenanceDenied('config_drift');
      const text = before.toString('utf8');
      if ((text.match(/^OPENAI_API_KEY=/gm) || []).length !== 1) throw new MaintenanceDenied('secret_field_ambiguous');
      const next = Buffer.from(text.replace(/^OPENAI_API_KEY=.*$/m, `OPENAI_API_KEY=${value}`));
      const temp = `${file}.maintenance-${randomUUID()}`;
      const fd = fs.openSync(temp, 'wx', stat.mode & 0o777);
      let primary;
      try {
        withDescriptor(fd, () => { fs.writeFileSync(fd, next); fs.fsyncSync(fd); });
        await check();
        const now = fs.lstatSync(file);
        if (now.ino !== stat.ino || now.dev !== stat.dev || hash(fs.readFileSync(file)) !== expectedHash) throw new MaintenanceDenied('config_drift');
        fs.renameSync(temp, file);
        const directory = fs.openSync(path.dirname(file), fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        withDescriptor(directory, () => fs.fsyncSync(directory));
        if (!fs.readFileSync(file).equals(next)) throw new MaintenanceDenied('config_write_unverified');
      } catch (error) { primary = error; throw error; }
      finally {
        const errors = [];
        try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(primary ? [primary, ...errors] : errors, 'Secret update cleanup failed');
      }
      return { field: 'OPENAI_API_KEY', verified: true }; // Never return secret or digest.
}

async function composeParticipant(binding, contract, check, execute = promisify(execFile), budget = {}) {
      const start = performance.now();
      startContract.assertPlan(binding, contract);
      startContract.verifyFiles(binding, contract);
      const deadline = Math.min(start + contract.timeoutMs, budget.deadline ?? Infinity);
      const checkedExecute = async (args) => {
        if (performance.now() >= deadline || budget.signal?.aborted) throw new MaintenanceDenied('deployment_deadline');
        await check();
        startContract.verifyFiles(binding, contract);
        // Authorization and binding I/O consume the same budget as the process itself.
        const remaining = Math.floor(deadline - performance.now());
        if (remaining <= 0 || budget.signal?.aborted) throw new MaintenanceDenied('deployment_deadline');
        const result = await execute(contract.docker, ['--host', contract.dockerHost, ...args], { timeout: remaining, maxBuffer: 1024 * 1024,
          ...(budget.signal ? { signal: budget.signal } : {}),
          env: { PATH: '/usr/bin:/bin', HOME: '/root', COMPOSE_DISABLE_ENV_FILE: '1' }, encoding: 'utf8' });
        if (performance.now() >= deadline || budget.signal?.aborted) throw new MaintenanceDenied('deployment_deadline');
        return result;
      };
      const daemon = JSON.parse((await checkedExecute(['info','--format','{{json .}}'])).stdout);
      if (daemon.ID !== contract.daemonId || daemon.OSType !== 'linux' || !['x86_64','amd64'].includes(daemon.Architecture)) {
        throw new MaintenanceDenied('daemon_binding_invalid');
      }
      const image = JSON.parse((await checkedExecute(['image', 'inspect', contract.imageId])).stdout);
      const imageConfig = startContract.assertImage(image, contract);
      for (const name of contract.serviceNetworks[contract.service]) {
        const expected = contract.networks[name];
        const networks = JSON.parse((await checkedExecute(['network','inspect',expected.id])).stdout);
        if (networks.length !== 1 || networks[0].Id !== expected.id || networks[0].Name !== expected.name
          || networks[0].Internal !== expected.internal || networks[0].Driver !== 'bridge'
          || networks[0].Scope !== 'local') throw new MaintenanceDenied('network_identity_invalid');
      }
      const prefix = ['compose','--env-file',contract.envFile.path, ...contract.files.flatMap((f) => ['-f', f.path]), '-p', contract.project];
      const config = JSON.parse((await checkedExecute([...prefix, 'config', '--format', 'json'])).stdout);
      startContract.assertCompose(binding, contract, config, imageConfig);
      const predecessors = async () => {
        for (const p of contract.predecessors) startContract.assertPredecessor(binding,contract,p,
          JSON.parse((await checkedExecute(['container','inspect',p.id])).stdout));
      };
      await predecessors();
      // A failed inventory is not absence. Never take over a stopped predecessor or reused name.
      const inventory=JSON.parse((await checkedExecute(['container','ls','--all','--filter',`name=^/${contract.containerNames[contract.service]}$`,'--format','json'])).stdout||'[]');
      if (!Array.isArray(inventory)||inventory.length) throw new MaintenanceDenied('container_name_not_fresh');
      await checkedExecute([...prefix,'create','--no-build','--no-recreate','--pull','never',contract.service]);
      const inspect = async id => JSON.parse((await checkedExecute(['container','inspect',id])).stdout);
      const id=startContract.assertContainer(binding,contract,config,imageConfig,await inspect(contract.containerNames[contract.service]),'created');
      await predecessors();
      await checkedExecute(['container','start',id]);
      startContract.assertContainer(binding,contract,config,imageConfig,await inspect(id),'running',id);
      await predecessors();
      startContract.verifyFiles(binding, contract);
      if (performance.now() >= deadline || budget.signal?.aborted) throw new MaintenanceDenied('deployment_deadline');
      return { commandCompleted: true, runtimeVerified: false, containerId: id, predecessorsRetained: true };
}

module.exports = { MaintenanceExecutor, replacePrivateSecret, composeParticipant };
