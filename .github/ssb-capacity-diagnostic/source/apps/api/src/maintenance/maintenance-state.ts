import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';

export type Binding = { root: string; service: string; generation: string };
export type WorkKind = 'http' | 'handler' | 'import' | 'worker' | 'job' | 'database' | 'provider' | 'grant' | 'migration' | 'deployment' | 'configuration';
type Work = { kind: WorkKind; generation: string; process: string; parent?: string; pilotRoot?: string;
  consumedPilotCandidate?: boolean;
  state: 'running' | 'completed' | 'uncertain' };
export type PilotContract = { tenantId: string; siteId: string; siteKey: string; tokenSha256: string;
  questionSha256: string; validFrom: string; expiresAt: string; embeddingModel: string; llmModel: string };
type Pilot = PilotContract & { generation: string; window: string; epoch: number; closed: boolean;
  sessionUsed: boolean; chatUsed: boolean; confirmed: Record<string, true>; queryUsed: boolean; llmUsed: boolean };
type Admission = { method: string; route: string; siteKey: unknown; token: unknown; message: unknown };
type Dispatch = { purpose: 'query_embedding' | 'llm_generation'; model: string };
export type State = { version: 1; service: string; generations: string[]; epoch: number;
  deployment?: { previousGeneration: string; generation: string; epoch: number; ownerSha256: string; bootstrap: boolean };
  phase: 'closed' | 'open'; legacy: 'unverified' | 'new-empty-service' | 'verified-transition'; work: Record<string, Work>;
  transition?: { digest: string; window: string; epoch: number; generation: string; sourceGeneration: string;
    closedAt: string; expiresAt: string; activeGeneration: string };
  pilot?: Pilot;
  terminal?: { digest: string; window: string; epoch: number; generation: string; recordedAt: string };
  recovery?: Record<string, { digest: string; window: string; epoch: number }> };

export class MaintenanceDenied extends Error {
  constructor(public readonly code: string) { super('Service maintenance boundary unavailable'); }
}

const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const utc = (value: unknown): number => typeof value === 'string' && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString() === value ? Date.parse(value) : NaN;
const legacyCleared = (state: State) => state.legacy === 'new-empty-service' || state.legacy === 'verified-transition';
const legacyKinds = ['http', 'stream', 'import', 'provider', 'queue', 'background', 'reporter', 'writers'];
const cleanupKinds = ['grants', 'traces', 'rule', 'opt-in', 'token', 'test-data'];

function validPilot(value: PilotContract) {
  return value && validId(value.tenantId) && validId(value.siteId) && validId(value.siteKey)
    && hex(value.tokenSha256) && hex(value.questionSha256)
    && [value.embeddingModel, value.llmModel].every(v => typeof v === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(v))
    && Number.isFinite(utc(value.validFrom)) && Number.isFinite(utc(value.expiresAt))
    && utc(value.expiresAt) > utc(value.validFrom) && utc(value.expiresAt) - utc(value.validFrom) <= 60 * 60 * 1000;
}

function withDescriptor<T>(fd: number, action: () => T): T {
  let primary: unknown;
  try { return action(); }
  catch (error) { primary = error; throw error; }
  finally {
    try { fs.closeSync(fd); }
    catch (cleanup) {
      if (primary !== undefined) throw new AggregateError([primary, cleanup], 'State I/O and descriptor cleanup failed');
      throw cleanup;
    }
  }
}

/** Trusted same-UID participants on a persistent LOCAL filesystem, not a root sandbox. */
export class MaintenanceState {
  private readonly identity: fs.Stats;
  private readonly processId = randomUUID();
  private readonly ownedProviders = new Set<string>();
  private readonly ownedWork = new Map<string, Work>();
  private readonly uncertainWork = new Set<string>();
  private providerCompletionUnverified = false;
  constructor(readonly binding: Binding) {
    if (!path.isAbsolute(binding.root) || !validId(binding.service) || !validId(binding.generation)) {
      throw new MaintenanceDenied('binding_missing');
    }
    this.identity = this.directory(binding.root);
  }

  private directory(name: string) {
    const stat = fs.lstatSync(name);
    if (!stat.isDirectory() || (stat.mode & 0o777) !== 0o700 || stat.uid !== process.getuid?.()) {
      throw new MaintenanceDenied('private_directory_required');
    }
    return stat;
  }

  private checkRoot() {
    const now = this.directory(this.binding.root);
    if (now.ino !== this.identity.ino || now.dev !== this.identity.dev) throw new MaintenanceDenied('root_replaced');
  }

  private readJson(name: string) {
    const fd = fs.openSync(name, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    return withDescriptor(fd, () => {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o777) !== 0o600
        || stat.uid !== process.getuid?.() || stat.size > 8 * 1024 * 1024) throw new MaintenanceDenied('state_file_invalid');
      return JSON.parse(fs.readFileSync(fd, 'utf8'));
    });
  }

  private read(): State {
    const state = this.readJson(path.join(this.binding.root, 'runtime-state.json')) as State;
    if (state.version !== 1 || state.service !== this.binding.service || !Array.isArray(state.generations)
      || !state.generations.length || !state.generations.every(validId)
      || !state.generations.includes(this.binding.generation) || !Number.isSafeInteger(state.epoch) || state.epoch < 0
      || !['open', 'closed'].includes(state.phase) || !['unverified', 'new-empty-service', 'verified-transition'].includes(state.legacy)
      || !state.work || typeof state.work !== 'object' || Array.isArray(state.work)) throw new MaintenanceDenied('state_binding_invalid');
    for (const [id, work] of Object.entries(state.work)) {
      if (!validId(id) || !work || !validId(work.generation) || !validId(work.process)
        || !['http', 'handler', 'import', 'worker', 'job', 'database', 'provider', 'grant', 'migration', 'deployment', 'configuration'].includes(work.kind)
        || !['running', 'completed', 'uncertain'].includes(work.state)
        || (work.consumedPilotCandidate !== undefined && work.consumedPilotCandidate !== true)
        || (work.parent !== undefined && (!validId(work.parent) || !state.work[work.parent]))
        || (work.pilotRoot !== undefined && (!validId(work.pilotRoot) || !state.work[work.pilotRoot]))) {
        throw new MaintenanceDenied('work_record_invalid');
      }
    }
    if (state.legacy === 'verified-transition' && (!state.transition || !hex(state.transition.digest)
      || !hex(state.transition.window) || !validId(state.transition.generation) || !validId(state.transition.sourceGeneration)
      || !Number.isSafeInteger(state.transition.epoch) || !validId(state.transition.activeGeneration)
      || !state.generations.includes(state.transition.activeGeneration)
      || !Number.isFinite(utc(state.transition.closedAt)) || !Number.isFinite(utc(state.transition.expiresAt)))) {
      throw new MaintenanceDenied('transition_invalid');
    }
    if (state.pilot && (!validPilot(state.pilot) || (state.phase !== 'closed' && !state.terminal) || !validId(state.pilot.generation)
      || !hex(state.pilot.window) || !Number.isSafeInteger(state.pilot.epoch)
      || ![state.pilot.closed, state.pilot.sessionUsed, state.pilot.chatUsed, state.pilot.queryUsed, state.pilot.llmUsed]
        .every(v => typeof v === 'boolean') || !state.pilot.confirmed || Array.isArray(state.pilot.confirmed)
      || Object.entries(state.pilot.confirmed).some(([key, value]) => !validId(key) || value !== true))) {
      throw new MaintenanceDenied('pilot_state_invalid');
    }
    if (state.terminal && (!state.pilot?.closed || !hex(state.terminal.digest)
      || state.terminal.window !== state.pilot.window || state.terminal.epoch !== state.pilot.epoch
      || !validId(state.terminal.generation) || !state.generations.includes(state.terminal.generation)
      || !Number.isFinite(utc(state.terminal.recordedAt)))) throw new MaintenanceDenied('terminal_state_invalid');
    if (state.recovery !== undefined && (!state.recovery || typeof state.recovery !== 'object'
      || Array.isArray(state.recovery) || Object.entries(state.recovery).some(([id, item]) =>
        !validId(id) || !item || !/^[a-f0-9]{64}$/.test(item.digest) || !/^[a-f0-9]{64}$/.test(item.window)
      || !Number.isSafeInteger(item.epoch) || item.epoch < 0))) throw new MaintenanceDenied('recovery_invalid');
    if (state.deployment && (!validId(state.deployment.previousGeneration) || !validId(state.deployment.generation)
      || !state.generations.includes(state.deployment.generation) || !hex(state.deployment.ownerSha256)
      || typeof state.deployment.bootstrap !== 'boolean' || !Number.isSafeInteger(state.deployment.epoch))) {
      throw new MaintenanceDenied('deployment_binding_invalid');
    }
    return state;
  }

  private save(state: State) {
    const bytes = JSON.stringify(state);
    if (Buffer.byteLength(bytes) > 8 * 1024 * 1024) throw new MaintenanceDenied('state_capacity_exhausted');
    const name = path.join(this.binding.root, `state-${randomUUID()}.tmp`);
    const fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try {
      withDescriptor(fd, () => { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); });
      fs.renameSync(name, path.join(this.binding.root, 'runtime-state.json'));
    } catch (primary) {
      try { fs.unlinkSync(name); }
      catch (cleanup) {
        if ((cleanup as NodeJS.ErrnoException).code !== 'ENOENT') throw new AggregateError([primary, cleanup], 'State I/O and temporary cleanup failed');
      }
      throw primary;
    }
    const root = fs.openSync(this.binding.root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    withDescriptor(root, () => fs.fsyncSync(root));
  }

  private transact<T>(fn: (state: State) => T, afterSave?: () => void): T {
    this.checkRoot();
    const mutex = path.join(this.binding.root, 'runtime-state-mutex');
    // No stealing or expiry: death in the critical section requires explicit recovery.
    const deadline = performance.now() + 50;
    for (;;) {
      try { fs.mkdirSync(mutex, { mode: 0o700 }); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || performance.now() >= deadline) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
      }
    }
    let committed = false;
    let primary: unknown;
    try {
      const state = this.read();
      const result = fn(state);
      this.checkRoot();
      this.save(state);
      committed = true;
      afterSave?.();
      return result;
    } catch (error) {
      // A policy denial precedes mutation; uncertain I/O leaves the mutex closed.
      if (error instanceof MaintenanceDenied) committed = true;
      primary = error;
      throw error;
    } finally {
      if (committed) {
        try { fs.rmdirSync(mutex); }
        catch (cleanup) {
          if (primary !== undefined) throw new AggregateError([primary, cleanup], 'State denial and cleanup failed');
          throw cleanup;
        }
      }
    }
  }

  private windowPresent() {
    try { fs.lstatSync(path.join(this.binding.root, 'maintenance-window')); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }

  assertOwner(owner: string) {
    this.checkRoot();
    if (typeof owner !== 'string' || !/^[a-f0-9]{64}$/.test(owner)) throw new MaintenanceDenied('owner_missing');
    this.directory(path.join(this.binding.root, 'maintenance-window'));
    const record = this.readJson(path.join(this.binding.root, 'maintenance-window', 'owner.json'));
    if (record.version !== 1 || typeof record.owner !== 'string' || !equal(record.owner, owner)) {
      throw new MaintenanceDenied('owner_stale');
    }
  }

  snapshot(): State { return this.transact((state) => structuredClone(state)); }

  /** Closing is monotone and needs no authority to reopen or switch generations. */
  stopAdmission() {
    return this.transact(state => {
      if (state.deployment && state.deployment.generation !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
      if (state.phase !== 'closed') { state.phase = 'closed'; state.epoch++; }
      if (state.pilot && !state.terminal) state.pilot.closed = true;
      return state.epoch;
    });
  }

  processWorkStatus() {
    const state = this.snapshot(), own = Object.values(state.work).filter(w => w.process === this.processId);
    return { running: own.filter(w => w.state === 'running').length, uncertain: own.filter(w => w.state === 'uncertain').length };
  }

  activateGeneration(owner: string, epoch: number, generation: string) {
    return this.transact(state => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch || !legacyCleared(state)
        || Object.values(state.work).some(w => w.state !== 'completed') || state.pilot && !state.terminal
        || !validId(generation) || state.generations.includes(generation)
        || state.deployment && state.deployment.generation !== this.binding.generation
        || state.transition && state.transition.activeGeneration !== this.binding.generation) throw new MaintenanceDenied('generation_activation_denied');
      const bootstrap = !state.deployment && state.legacy === 'new-empty-service' && Object.keys(state.work).length === 0;
      state.generations.push(generation);
      state.deployment = { previousGeneration: this.binding.generation, generation, epoch, ownerSha256: digest(owner), bootstrap };
      if (state.transition) state.transition.activeGeneration = generation;
      return structuredClone(state.deployment);
    });
  }

  assertDeployment(owner: string, epoch: number, previousGeneration: string, bootstrap: boolean) {
    this.assertEpoch(owner, epoch);
    const d = this.snapshot().deployment;
    if (!d || d.generation !== this.binding.generation || d.previousGeneration !== previousGeneration
      || d.epoch !== epoch || d.ownerSha256 !== digest(owner) || d.bootstrap !== bootstrap) throw new MaintenanceDenied('deployment_binding_invalid');
  }

  /** First installation is closed and explicitly UNVERIFIED, never a fabricated drain. */
  initializeClosed() {
    this.checkRoot();
    const file = path.join(this.binding.root, 'runtime-state.json');
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    withDescriptor(fd, () => {
      fs.writeFileSync(fd, JSON.stringify({ version: 1, service: this.binding.service,
        generations: [this.binding.generation], epoch: 0, phase: 'closed', legacy: 'unverified', work: {} }));
      fs.fsyncSync(fd);
    });
    const root = fs.openSync(this.binding.root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    withDescriptor(root, () => fs.fsyncSync(root));
  }

  admitGeneration(owner: string, epoch: number, generation: string) {
    return this.transact((state) => {
      this.assertOwner(owner);
      if (state.deployment) throw new MaintenanceDenied('retained_activation_required');
      if (!validId(generation) || state.phase !== 'closed' || state.epoch !== epoch) throw new MaintenanceDenied('generation_transition_invalid');
      if (state.transition && state.transition.activeGeneration !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
      if (state.pilot && !state.pilot.closed) throw new MaintenanceDenied('pilot_close_required');
      if (state.pilot && !state.terminal) throw new MaintenanceDenied('pilot_cleanup_required');
      if (Object.values(state.work).some(work => work.state !== 'completed'
        && ['grant', 'migration', 'deployment', 'configuration'].includes(work.kind))) {
        throw new MaintenanceDenied('writer_generation_change_blocked');
      }
      // Preserve every unresolved record. Admission remains closed in successors and rollback.
      if (!state.generations.includes(generation)) state.generations.push(generation);
      if (state.transition) state.transition.activeGeneration = generation;
    });
  }

  /** External observer receipts are evidence, never a claim that this runtime observed old work. */
  acceptLegacyCompletion(owner: string, epoch: number, file: string, expectedDigest: string) {
    return this.transact(state => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch || state.legacy !== 'unverified'
        || Object.values(state.work).some(w => w.state !== 'completed') || !hex(expectedDigest)
        || !validId(file)) throw new MaintenanceDenied('legacy_transition_invalid');
      const proof = this.readJson(path.join(this.binding.root, `legacy-${file}.json`));
      const now = Date.now();
      if (digest(JSON.stringify(proof)) !== expectedDigest || proof.version !== 1
        || proof.service !== state.service || proof.generation !== this.binding.generation
        || !validId(proof.sourceGeneration) || proof.sourceGeneration === proof.generation
        || proof.window !== digest(owner) || proof.epoch !== epoch
        || !Number.isFinite(utc(proof.closedAt)) || !Number.isFinite(utc(proof.expiresAt))
        || utc(proof.closedAt) > now || now >= utc(proof.expiresAt)
        || utc(proof.expiresAt) - utc(proof.closedAt) > 60 * 60 * 1000
        || !Array.isArray(proof.coverage) || proof.coverage.length !== legacyKinds.length
        || [...proof.coverage.map((x: { kind: string }) => x?.kind)].sort().join(',') !== [...legacyKinds].sort().join(',')) {
        throw new MaintenanceDenied('legacy_evidence_invalid');
      }
      const operations = new Set<string>();
      for (const scope of proof.coverage) {
        if (!hex(scope.admissionEvidence) || !hex(scope.writerEvidence) || !Array.isArray(scope.operations)
          || scope.operations.length > 128 || (scope.operations.length === 0 && !hex(scope.emptyInventoryEvidence))) {
          throw new MaintenanceDenied('legacy_inventory_invalid');
        }
        for (const entry of scope.operations) {
          if (!validId(entry.id) || operations.has(entry.id) || !hex(entry.receiptSha256)) throw new MaintenanceDenied('legacy_inventory_invalid');
          operations.add(entry.id);
          const receipt = this.readJson(path.join(this.binding.root, `legacy-receipt-${entry.id}.json`));
          if (digest(JSON.stringify(receipt)) !== entry.receiptSha256 || receipt.id !== entry.id
            || receipt.kind !== scope.kind || receipt.service !== state.service || receipt.window !== digest(owner)
            || receipt.sourceGeneration !== proof.sourceGeneration || receipt.outcome !== 'completed'
            || !hex(receipt.sourceEvidence) || !Number.isFinite(utc(receipt.acceptedAt))
            || !Number.isFinite(utc(receipt.completedAt)) || utc(receipt.acceptedAt) > utc(proof.closedAt)
            || utc(receipt.completedAt) < utc(receipt.acceptedAt) || utc(receipt.completedAt) > now) {
            throw new MaintenanceDenied('legacy_completion_invalid');
          }
        }
      }
      state.transition = { digest: expectedDigest, window: digest(owner), epoch,
        generation: this.binding.generation, sourceGeneration: proof.sourceGeneration,
        closedAt: proof.closedAt, expiresAt: proof.expiresAt, activeGeneration: this.binding.generation };
      state.legacy = 'verified-transition';
      return { completed: true, operations: operations.size, phase: state.phase };
    });
  }

  openPilot(owner: string, epoch: number, contract: PilotContract) {
    this.transact(state => {
      this.assertOwner(owner);
      if (!validPilot(contract) || state.phase !== 'closed' || state.epoch !== epoch
        || state.legacy !== 'verified-transition' || !state.transition
        || state.transition.activeGeneration !== this.binding.generation || state.transition.window !== digest(owner)
        || state.transition.epoch !== epoch || utc(contract.validFrom) < utc(state.transition.closedAt)
        || utc(contract.expiresAt) > Math.min(utc(state.transition.expiresAt), utc(state.transition.closedAt) + 25 * 60 * 1000)
        || state.pilot || Object.values(state.work).some(w => w.state !== 'completed')
        || Date.now() < utc(contract.validFrom) || Date.now() >= utc(contract.expiresAt)) {
        throw new MaintenanceDenied('pilot_transition_invalid');
      }
      state.pilot = { ...contract, generation: this.binding.generation, window: digest(owner), epoch,
        closed: false, sessionUsed: false, chatUsed: false, queryUsed: false, llmUsed: false, confirmed: {} };
    });
  }

  closePilot(owner: string, epoch: number) {
    this.transact(state => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch || !state.pilot || state.pilot.window !== digest(owner)) {
        throw new MaintenanceDenied('pilot_transition_invalid');
      }
      state.pilot.closed = true; // Preserve counters and all unresolved work; never reset a P05 attempt.
    });
  }

  /** The private operator collects real, resource-scoped observations; hashes contain no payloads. */
  cleanupBinding(owner: string, epoch: number) {
    return this.transact(state => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch || !state.pilot?.closed || state.terminal
        || state.pilot.window !== digest(owner) || state.transition?.activeGeneration !== this.binding.generation
        || Object.values(state.work).some(w => w.state !== 'completed')) throw new MaintenanceDenied('cleanup_not_ready');
      return { service: state.service, generation: this.binding.generation, window: digest(owner), epoch,
        stateSha256: digest(JSON.stringify(state)), pilotSha256: digest(JSON.stringify(state.pilot)) };
    });
  }

  sealCleanup(owner: string, epoch: number, file: string, expectedDigest: string) {
    return this.transact(state => {
      this.assertOwner(owner);
      if (!validId(file) || !hex(expectedDigest) || state.phase !== 'closed' || state.epoch !== epoch
        || !state.pilot?.closed || state.pilot.window !== digest(owner)
        || state.transition?.activeGeneration !== this.binding.generation
        || Object.values(state.work).some(w => w.state !== 'completed')) throw new MaintenanceDenied('cleanup_not_ready');
      if (state.terminal) {
        if (state.terminal.digest !== expectedDigest) throw new MaintenanceDenied('cleanup_conflict');
        return { sealed: true, alreadyApplied: true };
      }
      const proof = this.readJson(path.join(this.binding.root, `cleanup-${file}.json`));
      const now = Date.now();
      if (digest(JSON.stringify(proof)) !== expectedDigest || proof.version !== 1
        || proof.service !== state.service || proof.generation !== this.binding.generation
        || proof.window !== digest(owner) || proof.epoch !== epoch
        || proof.stateSha256 !== digest(JSON.stringify(state)) || proof.pilotSha256 !== digest(JSON.stringify(state.pilot))
        || !Number.isFinite(utc(proof.completedAt)) || utc(proof.completedAt) > now
        || now - utc(proof.completedAt) > 5 * 60 * 1000
        || utc(proof.completedAt) >= utc(state.transition.closedAt) + 50 * 60 * 1000
        || now >= utc(state.transition.closedAt) + 60 * 60 * 1000
        || !Array.isArray(proof.observations) || proof.observations.length !== cleanupKinds.length
        || [...proof.observations.map((v: { kind: string }) => v?.kind)].sort().join(',') !== [...cleanupKinds].sort().join(',')) {
        throw new MaintenanceDenied('cleanup_evidence_invalid');
      }
      for (const observation of proof.observations) {
        if (observation.pilotSha256 !== proof.pilotSha256 || !hex(observation.inventorySha256)
          || !hex(observation.absenceSha256) || observation.outcome !== (observation.kind === 'grants' ? 'revoked' : 'absent')
          || !Number.isFinite(utc(observation.verifiedAt)) || utc(observation.verifiedAt) > utc(proof.completedAt)
          || now - utc(observation.verifiedAt) > 5 * 60 * 1000
          || utc(observation.verifiedAt) < utc(proof.completedAt) - 5 * 60 * 1000
          || (observation.kind === 'traces' && (observation.producerGeneration !== state.pilot.generation
            || observation.beforeRecreate !== true))) throw new MaintenanceDenied('cleanup_observation_invalid');
      }
      state.terminal = { digest: expectedDigest, window: digest(owner), epoch,
        generation: this.binding.generation, recordedAt: new Date(now).toISOString() };
      return { sealed: true, alreadyApplied: false };
    });
  }

  /** Durable open first, then atomic owner-bound retirement. Either interruption remains retryable. */
  releaseTerminal(owner: string, epoch: number) {
    this.transact(state => {
      if (!state.terminal || !state.pilot?.closed || state.epoch !== epoch
        || state.terminal.epoch !== epoch || state.terminal.window !== digest(owner)
        || state.transition?.activeGeneration !== this.binding.generation
        || Date.now() >= utc(state.transition.closedAt) + 60 * 60 * 1000
        || Object.values(state.work).some(w => w.state !== 'completed')) throw new MaintenanceDenied('terminal_release_invalid');
      if (this.windowPresent()) this.assertOwner(owner);
      else {
        const released = this.readJson(path.join(this.binding.root, `released-window-${epoch}`, 'owner.json'));
        if (released.version !== 1 || released.owner !== owner || state.phase !== 'open') throw new MaintenanceDenied('owner_stale');
      }
      state.phase = 'open';
    }, () => {
      // Keep the state mutex until retirement: a concurrent close must not advance the epoch.
      const source = path.join(this.binding.root, 'maintenance-window');
      const target = path.join(this.binding.root, `released-window-${epoch}`);
      if (this.windowPresent()) {
        this.assertOwner(owner);
        if (fs.existsSync(target)) throw new MaintenanceDenied('release_target_exists');
        fs.renameSync(source, target);
      }
      const directory = fs.openSync(this.binding.root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      withDescriptor(directory, () => fs.fsyncSync(directory));
    });
    return { released: true, pilotConsumed: true };
  }

  confirmPilotScope(id: string, tenantId: string | null | undefined, siteId: string) {
    this.transact(state => {
      const work = state.work[id];
      if (work?.consumedPilotCandidate && state.terminal && state.pilot && tenantId === state.pilot.tenantId
        && siteId === state.pilot.siteId) throw new MaintenanceDenied('pilot_consumed');
      if (!work?.pilotRoot) return;
      if (!state.pilot || work.process !== this.processId || work.state !== 'running'
        || tenantId !== state.pilot.tenantId || siteId !== state.pilot.siteId) throw new MaintenanceDenied('pilot_scope_invalid');
      state.pilot.confirmed[work.pilotRoot] = true;
    });
  }

  beginPilotRequest(request: Admission) { return this.begin('http', undefined, undefined, undefined, request); }
  beginDispatch(parent: string | undefined, owner: string | undefined, dispatch?: Dispatch) {
    return this.begin('provider', parent, owner, undefined, undefined, dispatch);
  }

  private completionReceipt(id: string, work: Work) {
    return { version: 1, service: this.binding.service, id, generation: work.generation,
      process: work.process, kind: work.kind, parent: work.parent ?? null, outcome: 'completed' };
  }

  private receiptPath(id: string) {
    if (!validId(id)) throw new MaintenanceDenied('work_record_invalid');
    return path.join(this.binding.root, `completion-${id}.json`);
  }

  private publishCompletion(id: string, work: Work) {
    this.checkRoot();
    const name = this.receiptPath(id), bytes = JSON.stringify(this.completionReceipt(id, work));
    let fd: number;
    try { fd = fs.openSync(name, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (JSON.stringify(this.readJson(name)) !== bytes) throw new MaintenanceDenied('completion_conflict');
      return;
    }
    withDescriptor(fd, () => { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); });
    const directory = fs.openSync(this.binding.root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    withDescriptor(directory, () => fs.fsyncSync(directory));
  }

  /** Only a durable receipt from the original successful completion path is evidence. */
  recoverCompleted(owner: string, epoch: number, id: string) {
    return this.transact((state) => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch) throw new MaintenanceDenied('epoch_changed');
      let receipt: ReturnType<MaintenanceState['completionReceipt']>;
      try { receipt = this.readJson(this.receiptPath(id)); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new MaintenanceDenied('completion_missing');
        throw error;
      }
      const proof = { digest: digest(JSON.stringify(receipt)), window: digest(owner), epoch };
      const prior = state.recovery?.[id];
      if (prior) {
        if (JSON.stringify(prior) !== JSON.stringify(proof)) throw new MaintenanceDenied('completion_reused');
        return { id, recovered: true, alreadyApplied: true };
      }
      const work = state.work[id];
      if (!work || !['running', 'completed'].includes(work.state) || JSON.stringify(receipt) !== JSON.stringify(this.completionReceipt(id, work))) {
        throw new MaintenanceDenied('completion_binding_invalid');
      }
      const alreadyApplied = work.state === 'completed';
      if (Object.keys(state.recovery ?? {}).length >= 1024) throw new MaintenanceDenied('recovery_capacity_exhausted');
      state.recovery ??= {};
      state.recovery[id] = proof;
      work.state = 'completed';
      // Never open, retry external work, replay effects, remove a mutex, or reset the provider latch.
      return { id, recovered: true, alreadyApplied };
    });
  }

  begin(kind: WorkKind, parent?: string, owner?: string, epoch?: number, admission?: Admission, dispatch?: Dispatch): string {
    if (kind === 'provider' && this.providerCompletionUnverified) throw new MaintenanceDenied('external_work_uncertain');
    return this.transact((state) => {
      const ancestor = parent ? state.work[parent] : undefined;
      if (state.deployment && state.deployment.generation !== this.binding.generation
        || state.transition && state.transition.activeGeneration !== this.binding.generation) {
        throw new MaintenanceDenied('generation_retired');
      }
      const pilot = state.pilot;
      const consumedPilotCandidate = Boolean(state.terminal && admission && pilot
        && ((hex(admission.token) && digest(`${pilot.tenantId}\0${pilot.siteId}\0${admission.token}`) === pilot.tokenSha256)
          || (typeof admission.message === 'string' && digest(admission.message) === pilot.questionSha256)));
      if (owner && kind === 'deployment' && pilot && !state.terminal) throw new MaintenanceDenied('pilot_cleanup_required');
      if (state.terminal && owner && state.epoch === state.terminal.epoch && kind !== 'deployment') throw new MaintenanceDenied('cleanup_sealed');
      let pilotAdmission = false;
      if (pilot && !state.terminal && (admission || ancestor?.pilotRoot || owner)) {
        if (owner && !pilot.closed) throw new MaintenanceDenied('pilot_writer_closed');
        if (admission || kind === 'provider') {
          const window = this.windowPresent() ? this.readJson(path.join(this.binding.root, 'maintenance-window/owner.json')) : undefined;
          if (pilot.closed || pilot.generation !== this.binding.generation || state.epoch !== pilot.epoch
            || window?.version !== 1 || !hex(window.owner) || digest(window.owner) !== pilot.window
            || Date.now() < utc(pilot.validFrom) || Date.now() >= utc(pilot.expiresAt)) throw new MaintenanceDenied('pilot_closed');
        }
        if (admission) {
          if (kind !== 'http' || parent || owner || admission.method !== 'POST' || admission.siteKey !== pilot.siteKey
            || !state.transition || Date.now() >= utc(state.transition.closedAt) + 15 * 60 * 1000
            || !hex(admission.token) || digest(`${pilot.tenantId}\0${pilot.siteId}\0${admission.token}`) !== pilot.tokenSha256
            || Object.values(state.work).some(w => w.state !== 'completed')) throw new MaintenanceDenied('pilot_request_invalid');
          if (admission.route === '/widget/session' && !pilot.sessionUsed && !pilot.chatUsed) pilot.sessionUsed = true;
          else if (admission.route === '/widget/chat/message' && !pilot.chatUsed && pilot.sessionUsed
            && typeof admission.message === 'string' && digest(admission.message) === pilot.questionSha256) pilot.chatUsed = true;
          else throw new MaintenanceDenied('pilot_request_invalid');
          pilotAdmission = true;
        }
        if (ancestor?.pilotRoot) {
          if (!['handler', 'database', 'provider'].includes(kind)) throw new MaintenanceDenied('pilot_operation_invalid');
          if (kind === 'provider') {
            if (!pilot.chatUsed || !pilot.confirmed[ancestor.pilotRoot] || !dispatch) throw new MaintenanceDenied('pilot_dispatch_invalid');
            if (dispatch.purpose === 'query_embedding' && dispatch.model === pilot.embeddingModel && !pilot.queryUsed) pilot.queryUsed = true;
            else if (dispatch.purpose === 'llm_generation' && dispatch.model === pilot.llmModel && !pilot.llmUsed) pilot.llmUsed = true;
            else throw new MaintenanceDenied('pilot_dispatch_invalid');
          }
        }
      }
      if (parent && (!ancestor || ancestor.state !== 'running' || ancestor.process !== this.processId
        || ancestor.generation !== this.binding.generation)) throw new MaintenanceDenied('parent_not_active');
      // An uncertain external call is not a retry opportunity, even for the owner.
      if (kind === 'provider' && Object.values(state.work).some((w) => w.kind === 'provider'
        && (w.state === 'uncertain' || (w.state === 'running' && w.process !== this.processId)))) {
        throw new MaintenanceDenied('external_work_uncertain');
      }
      if (owner) this.assertOwner(owner);
      const privileged = ['grant', 'migration', 'deployment', 'configuration'].includes(kind);
      // A worker permit is not permission to drain its entire waiting queue after close.
      if (kind === 'job' && (state.phase !== 'open' || this.windowPresent())) throw new MaintenanceDenied('admission_closed');
      if (owner && !ancestor && !privileged) throw new MaintenanceDenied('owner_operation_not_allowed');
      if (epoch !== undefined && state.epoch !== epoch) throw new MaintenanceDenied('epoch_changed');
      if (!ancestor && !owner && Object.values(state.work).some((w) => w.state === 'uncertain')) {
        throw new MaintenanceDenied('prior_work_uncertain');
      }
      if (owner && privileged) {
        const ancestors = new Set<string>();
        for (let cursor = parent; cursor; cursor = state.work[cursor]?.parent) {
          if (ancestors.has(cursor)) throw new MaintenanceDenied('work_cycle');
          ancestors.add(cursor);
        }
        if (state.phase !== 'closed' || Object.entries(state.work).some(([key, work]) => !ancestors.has(key) && work.state !== 'completed')) {
          throw new MaintenanceDenied('writer_drain_unproven');
        }
      }
      if ((state.phase !== 'open' || this.windowPresent()) && (!ancestor || privileged) && !owner && !pilotAdmission) {
        throw new MaintenanceDenied('admission_closed');
      }
      if (!legacyCleared(state)) throw new MaintenanceDenied('legacy_completion_unverified');
      // Only completed subtrees may be compacted. Retain ancestors of every live/uncertain record.
      if (Object.keys(state.work).length > 128) {
        const keep = new Set<string>();
        for (const [key, work] of Object.entries(state.work)) {
          if (work.state === 'completed') continue;
          let cursor: string | undefined = key;
          while (cursor && !keep.has(cursor)) { keep.add(cursor); cursor = state.work[cursor]?.parent; }
        }
        for (const key of Object.keys(state.work)) if (!keep.has(key)) delete state.work[key];
      }
      if (Object.keys(state.work).length >= 1024) throw new MaintenanceDenied('work_capacity_exhausted');
      const id = randomUUID();
      state.work[id] = { kind, generation: this.binding.generation, process: this.processId,
        state: 'running', ...(parent ? { parent } : {}),
        ...((consumedPilotCandidate || ancestor?.consumedPilotCandidate) ? { consumedPilotCandidate: true } : {}),
        ...(pilotAdmission ? { pilotRoot: id } : ancestor?.pilotRoot ? { pilotRoot: ancestor.pilotRoot } : {}) };
      if (kind === 'provider') this.ownedProviders.add(id);
      this.ownedWork.set(id, structuredClone(state.work[id]));
      return id;
    });
  }

  end(id: string, uncertain = false, owner?: string, epoch?: number) {
    if (uncertain) this.uncertainWork.add(id);
    uncertain ||= this.uncertainWork.has(id);
    const provider = this.ownedProviders.has(id);
    // Same-process dispatch must fail closed BEFORE fallible journal publication.
    // After process loss the persisted running record blocks other process identities.
    if (provider && uncertain) this.providerCompletionUnverified = true;
    try {
      const owned = this.ownedWork.get(id);
      if (!owned) throw new MaintenanceDenied('work_not_owned');
      if (!uncertain) this.publishCompletion(id, owned);
      this.transact((state) => {
        if (owner !== undefined || epoch !== undefined) {
          this.assertOwner(owner!);
          if (state.phase !== 'closed' || state.epoch !== epoch) throw new MaintenanceDenied('epoch_changed');
          if (state.transition && state.transition.activeGeneration !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
        }
        const work = state.work[id];
        if (!work || work.process !== this.processId || work.generation !== this.binding.generation
          || work.state !== 'running') throw new MaintenanceDenied('work_not_owned');
        work.state = uncertain ? 'uncertain' : 'completed';
      });
      this.ownedProviders.delete(id);
      this.ownedWork.delete(id);
      this.uncertainWork.delete(id);
      if (!uncertain) fs.unlinkSync(this.receiptPath(id));
    } catch (error) {
      if (provider) this.providerCompletionUnverified = true;
      throw error;
    }
  }

  close(owner: string) {
    return this.transact((state) => {
      this.assertOwner(owner);
      if (state.deployment && state.deployment.generation !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
      if (state.phase === 'closed') return state.epoch;
      state.phase = 'closed';
      state.epoch++;
      return state.epoch;
    });
  }

  assertEpoch(owner: string, epoch: number) {
    this.transact((state) => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch) throw new MaintenanceDenied('epoch_changed');
      if (state.deployment && state.deployment.generation !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
      if (state.transition && state.transition.activeGeneration !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
    });
  }

  drained(owner: string, epoch: number) {
    return this.transact((state) => {
      this.assertOwner(owner);
      if (state.deployment && state.deployment.generation !== this.binding.generation) throw new MaintenanceDenied('generation_retired');
      if (state.phase !== 'closed' || state.epoch !== epoch || !legacyCleared(state)
        || Object.values(state.work).some((w) => w.state !== 'completed')) throw new MaintenanceDenied('drain_unproven');
      return { service: state.service, epoch, generation: this.binding.generation, completed: true as const };
    });
  }

  open(owner: string, epoch: number) {
    this.transact((state) => {
      this.assertOwner(owner);
      if (state.phase !== 'closed' || state.epoch !== epoch || !legacyCleared(state) || (state.pilot && !state.terminal)
        || state.deployment && state.deployment.generation !== this.binding.generation
        || (state.terminal && state.epoch === state.terminal.epoch)
        || (state.transition && state.transition.activeGeneration !== this.binding.generation)
        || Object.values(state.work).some((w) => w.state !== 'completed')) throw new MaintenanceDenied('drain_unproven');
      state.phase = 'open';
      // The retained window still denies new roots until its owner explicitly releases it.
    });
  }
}
