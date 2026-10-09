'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const { MaintenanceExecutor, replacePrivateSecret, composeParticipant } = require('./maintenance-executor.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function privateBytes(file, uid) {
  if (!path.isAbsolute(file)) throw Error('absolute private path required');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== uid || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600 || stat.size > 1024 * 1024) {
      throw Error('private owner and mode required');
    }
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}

// A short-lived root operator, NOT a service endpoint. State authority stays with the application UID.
async function executePlan(file) {
  const start = performance.now();
  if (process.getuid() !== 0) throw Error('privileged operator required');
  const bytes = privateBytes(file, 0), plan = JSON.parse(bytes);
  if (plan.version !== 1 || !Number.isSafeInteger(plan.uid) || plan.uid <= 0 || !Number.isSafeInteger(plan.gid) || plan.gid <= 0
    || !['replace-provider-field', 'start-retained-participant', 'activate-retained-generation'].includes(plan.action)
    || !Number.isSafeInteger(plan.epoch) || !/^[a-f0-9]{64}$/.test(plan.ownerSha256 || '')
    || !Number.isSafeInteger(plan.timeoutMs) || plan.timeoutMs < 1000 || plan.timeoutMs > 10000) throw Error('invalid private plan');
  const deadline=start+plan.timeoutMs, workDeadline=deadline-500;
  if (plan.action !== 'replace-provider-field' && (plan.uid !== 1000 || plan.gid !== 1000
    || plan.action === 'start-retained-participant' && plan.contract?.version !== 3
    || plan.action === 'activate-retained-generation' && !/^[a-zA-Z0-9_-]{1,128}$/.test(plan.nextGeneration || ''))) {
    throw Error('role-bound start plan required');
  }
  let secret;
  if (plan.action === 'replace-provider-field') {
    secret = privateBytes(plan.input, 0).toString('utf8');
    if (!/^[A-Za-z0-9_-]+$/.test(secret) || hash(privateBytes(plan.target, 0)) !== plan.expectedSha256) {
      throw Error('private secret input or target binding invalid');
    }
  }
  const nonce = randomUUID(), controller = new AbortController();
  const child = fork(__filename, ['state-owner'], { uid: plan.uid, gid: plan.gid, execArgv: [],
    env: { PATH: '/usr/bin:/bin', NODE_ENV: 'production' }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  let timer, pending, exit;
  const exited = new Promise(resolve => { exit = resolve; });
  child.once('exit', (code, signal) => { pending?.reject(Error('state owner exited before acknowledgement')); exit({ code, signal }); });
  child.on('error', error => { pending?.reject(error); if (!child.pid) exit({ error: 'state owner spawn failed' }); });
  child.on('message', message => {
    if (!pending || message.nonce !== nonce || message.id !== pending.id) return;
    const request = pending; pending = undefined;
    if (message.error) request.reject(Error(message.error)); else request.resolve(message.result);
  });
  function request(action) {
    if (pending || performance.now() >= workDeadline || !child.connected) return Promise.reject(Error('operator deadline or channel unavailable'));
    return new Promise((resolve, reject) => {
      const id = randomUUID(); pending = { id, resolve, reject };
      child.send({ nonce, id, action, ...(action === 'begin' ? { binding: plan.binding, epoch: plan.epoch,
        ownerSha256: plan.ownerSha256, activation: plan.action === 'activate-retained-generation' ? plan.nextGeneration : undefined,
        deployment: plan.action === 'start-retained-participant' ? { previousGeneration: plan.contract.previousGeneration, bootstrap: plan.contract.bootstrap } : undefined,
        kind: plan.action === 'replace-provider-field' ? 'configuration' : 'deployment' } : {}) }, error => {
        if (error && pending?.id === id) { pending = undefined; reject(error); }
      });
    });
  }
  const check = async () => {
    if (!privateBytes(file, 0).equals(bytes)) throw Error('private plan changed');
    await request('check');
  };
  let registered = false, effectCompleted = false, primary;
  timer = setTimeout(() => {
    controller.abort(); pending?.reject(Error('operator deadline')); pending = undefined; child.kill();
  }, Math.max(0, workDeadline-performance.now()));
  try {
    const identity = await request('begin'); registered = plan.action !== 'activate-retained-generation';
    if (identity.uid !== plan.uid || identity.gid !== plan.gid || identity.groups.some(group => group !== plan.gid)) throw Error('unexpected state owner identity');
    if (plan.action === 'activate-retained-generation') {
      if (performance.now()>=workDeadline || !privateBytes(file,0).equals(bytes)) throw Error('activation postcheck failed');
      return { generation: identity.activation, stateOwner: identity, privilegedOperator: 0, admissionOpen: false };
    }
    let result;
    if (plan.action === 'replace-provider-field') {
      result = await replacePrivateSecret(plan.target, plan.expectedSha256, secret, check);
    } else {
      result = await composeParticipant(plan.binding, { ...plan.contract,
        timeoutMs: Math.floor(workDeadline-performance.now()) }, check, undefined,
      { deadline: workDeadline, signal: controller.signal });
    }
    // Record the observed outcome before fallible postchecks. Failed accounting never reclassifies success.
    effectCompleted = true;
    await request('complete'); registered = false;
    if (performance.now() >= workDeadline) throw Error('operator deadline');
    if (!privateBytes(file, 0).equals(bytes)) throw Error('private plan changed');
    if (performance.now() >= workDeadline) throw Error('operator deadline');
    return { ...result, stateOwner: identity, privilegedOperator: 0 };
  } catch (error) {
    primary = error;
    if (registered && !effectCompleted) {
      try { await request('uncertain'); }
      catch (cleanup) { primary = new AggregateError([primary, cleanup], 'Operator effect and accounting unverified'); throw primary; }
    }
    throw primary;
  } finally {
    clearTimeout(timer);
    try { await finishStateOwner(child,exited,deadline); }
    catch (cleanup) { throw primary ? new AggregateError([primary,cleanup],'Operator and child completion failed') : cleanup; }
  }
}

async function finishStateOwner(child,exited,deadline) {
  const wait=ms=>new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),Math.max(0,ms));
    exited.then(()=>{clearTimeout(timer);resolve(true);});
  });
  if(child.connected)child.disconnect();
  if(child.exitCode!==null||child.signalCode!==null)return;
  child.kill('SIGTERM');
  if(await wait(Math.min(100,deadline-performance.now())))return;
  child.kill('SIGKILL');
  if(!await wait(deadline-performance.now()))throw Error('state_owner_exit_unverified');
}

if (process.argv[2] === 'state-owner' && process.send && process.getuid() !== 0) {
  let executor, owner, epoch, work, nonce, deployment;
  process.on('message', message => {
    try {
      let result = {};
      if (message.action === 'begin' && !executor) {
        nonce = message.nonce; epoch = message.epoch; executor = new MaintenanceExecutor(message.binding);
        const record = JSON.parse(privateBytes(path.join(message.binding.root, 'maintenance-window/owner.json'), process.getuid()));
        owner = record.owner;
        if (typeof owner !== 'string' || hash(owner) !== message.ownerSha256) throw Error('owner binding mismatch');
        executor.state.drained(owner, epoch);
        result = { uid: process.getuid(), gid: process.getgid(), groups: process.getgroups() };
        if (message.activation) result.activation = executor.state.activateGeneration(owner,epoch,message.activation);
        else {
          deployment=message.deployment;
          if(deployment) executor.state.assertDeployment(owner,epoch,deployment.previousGeneration,deployment.bootstrap);
          work = executor.state.begin(message.kind, undefined, owner, epoch);
        }
      } else {
        if (!executor || nonce !== message.nonce || !work) throw Error('state owner channel invalid');
        if (message.action === 'check') {
          if(deployment) executor.state.assertDeployment(owner,epoch,deployment.previousGeneration,deployment.bootstrap);
          else executor.state.assertEpoch(owner, epoch);
        }
        else if (message.action === 'complete' || message.action === 'uncertain') {
          executor.state.end(work, message.action === 'uncertain', owner, epoch); work = undefined;
        } else throw Error('unsupported state action');
      }
      process.send({ id: message.id, nonce: message.nonce, result });
    } catch (error) { process.send({ id: message.id, nonce: message.nonce, error: error.code || error.message }); }
  });
  process.on('disconnect', () => process.exit(0));
} else if (require.main === module) {
  executePlan(process.argv[2]).then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(error => {
    // Deliberately no plan, input, argv or exec stdout/stderr dump.
    console.error(error instanceof AggregateError ? 'privileged_operation_and_accounting_failed' : 'privileged_operation_failed');
    process.exitCode = 1;
  });
}
module.exports = { executePlan, finishStateOwner };
