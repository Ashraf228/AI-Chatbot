import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

type Waiter = { name: string; identity: fs.Stats; ticket: number | null; ticketIdentity?: fs.Stats };
const prefix = 'runtime-state-wait-';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const same = (a: fs.Stats, b: fs.Stats) => a.dev === b.dev && a.ino === b.ino;
const invalid = () => Object.assign(new Error('Maintenance mutex queue invalid'), { code: 'EIO' });
type Stage = 'initial-check' | 'waiter-create' | 'queue-scan' | 'ticket-create' | 'queue-wait' | 'mutex-create' | 'mutex-release' | 'waiter-cleanup';
type MutexFailure = Readonly<{ origin: 'deadline' | 'filesystem'; stage: Stage }>;
const diagnostics = new WeakMap<object, MutexFailure>();
export const readMutexFailure = (error: unknown): MutexFailure | undefined =>
  error !== null && typeof error === 'object' ? diagnostics.get(error) : undefined;
const diagnose = (error: unknown, origin: MutexFailure['origin'], stage: Stage) => {
  try { if (error !== null && typeof error === 'object' && !diagnostics.has(error)) diagnostics.set(error, Object.freeze({ origin, stage })); } catch { /* Original error wins. */ }
};
const expired = (stage: Stage) => {
  const error = Object.assign(new Error('Maintenance mutex acquisition expired'), { code: 'EEXIST' });
  diagnose(error, 'deadline', stage);return error;
};
const io = <T>(stage: Stage, action: () => T): T => {
  try { return action(); } catch (error) { diagnose(error, 'filesystem', stage);throw error; }
};
type MutexIo = 'mutex-acquire' | 'mutex-release';
const failures = new WeakMap<object, MutexIo>();
export const readMutexIoFailure = (error: unknown): MutexIo | undefined =>
  error !== null && typeof error === 'object' ? failures.get(error) : undefined;
const note = (error: unknown, stage: MutexIo) => {
  try { if (error !== null && typeof error === 'object') failures.set(error, stage); } catch { /* Original error wins. */ }
};

/** Trusted same-UID peers on the existing private local state filesystem. */
export function acquireStateMutex(root: string, checkRoot: () => void, startedAt: number,
  attempt: () => void = () => {}): () => void {
  const deadline = startedAt + 50, mutex = path.join(root, 'runtime-state-mutex');
  const own = prefix + randomUUID(), ownPath = path.join(root, own);
  let identity: fs.Stats | undefined, ticketIdentity: fs.Stats | undefined;
  let ticket: number | null = null, publishing = false, createdMutex = false, mutexIdentity: fs.Stats | undefined;
  let busy: unknown;
  let stage: Stage = 'initial-check';
  const directory = (p: string) => {
    const s = io(stage, () => fs.lstatSync(p));
    if (!s.isDirectory() || (s.mode & 0o777) !== 0o700 || s.uid !== process.getuid?.()) throw invalid();
    return s;
  };
  const stable = (p: string, expected: fs.Stats) => { if (!same(directory(p), expected)) throw invalid(); };
  const within = (reason: unknown = busy) => { if (performance.now() >= deadline) throw reason ?? expired(stage); };
  const entries = (p: string, maximum: number, timed = true, filter = (_name: string) => true): string[] => {
    if (timed) within();
    const dir = io(stage, () => fs.opendirSync(p, { bufferSize: 1 })), names: string[] = [];
    let primary: unknown, failed = false;
    try {
      for (let count = 0; ; count++) {
        if (timed) within();const entry = io(stage, () => dir.readSync());
        if (!entry) return names;
        if (count >= maximum) throw invalid();
        if (filter(entry.name)) names.push(entry.name);
        if (names.length > 64) throw invalid();
      }
    } catch (error) { primary = error;failed = true;throw error; }
    finally {
      try { io(stage, () => dir.closeSync()); }
      catch (cleanup) { if (failed) throw new AggregateError([primary, cleanup], 'Queue scan and close failed');throw cleanup; }
    }
  };
  const scan = (): Waiter[] => {
    stage = 'queue-scan';
    checkRoot();
    const names = entries(root, 16384, true, name => name.startsWith(prefix));
    const rows: Waiter[] = [];
    for (const name of names) {
      if (!uuid.test(name.slice(prefix.length))) throw invalid();
      const p = path.join(root, name);
      try {
        const id = directory(p), children = entries(p, 1);
        let number: number | null = null, child: fs.Stats | undefined;
        if (children.length) {
          if (!/^[1-9][0-9]{0,15}$/.test(children[0])) throw invalid();
          number = Number(children[0]);
          if (!Number.isSafeInteger(number)) throw invalid();
          const childPath = path.join(p, children[0]);child = directory(childPath);
          entries(childPath, 0);
          stable(childPath, child);
        }
        stable(p, id);rows.push({ name, identity: id, ticket: number, ticketIdentity: child });
      } catch (error) {
        // A peer may finish between listing and inspection. No other error is absence.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || name === own) throw error;
      }
    }
    checkRoot();return rows;
  };
  const removeOwn = () => {
    stage = 'waiter-cleanup';
    checkRoot();
    if (!identity || publishing && !ticketIdentity) throw invalid();
    stable(ownPath, identity);
    const children = entries(ownPath, 1, false);
    if (ticket === null) { if (children.length) throw invalid(); }
    else {
      if (!ticketIdentity || children.length !== 1 || children[0] !== String(ticket)) throw invalid();
      const p = path.join(ownPath, String(ticket));stable(p, ticketIdentity);
      io(stage, () => fs.rmdirSync(p));
    }
    stable(ownPath, identity);io(stage, () => fs.rmdirSync(ownPath));
  };
  const removeMutex = () => {
    stage = 'mutex-release';
    checkRoot();if (!mutexIdentity) throw invalid();stable(mutex, mutexIdentity);
    try { io(stage, () => fs.rmdirSync(mutex)); } catch (error) { note(error, 'mutex-release');throw error; }
  };
  try {
    checkRoot();within();
    stage = 'waiter-create';io(stage, () => fs.mkdirSync(ownPath, { mode: 0o700 }));identity = directory(ownPath);
    const rows = scan();
    if (!rows.some(r => r.name === own && same(r.identity, identity!) && r.ticket === null)) throw invalid();
    const max = Math.max(0, ...rows.map(r => r.ticket || 0));
    if (max === Number.MAX_SAFE_INTEGER) throw invalid();
    within();ticket = max + 1;publishing = true;
    const numberPath = path.join(ownPath, String(ticket));
    // The empty numbered directory publishes a complete ticket atomically.
    stage = 'ticket-create';io(stage, () => fs.mkdirSync(numberPath, { mode: 0o700 }));ticketIdentity = directory(numberPath);
    for (;;) {
      within(busy);const current = scan();within(busy);
      const self = current.find(r => r.name === own);
      if (!self || !same(self.identity, identity) || self.ticket !== ticket
        || !self.ticketIdentity || !same(self.ticketIdentity, ticketIdentity)) throw invalid();
      const ahead = current.some(r => r.name !== own && (r.ticket === null
        || r.ticket < ticket! || r.ticket === ticket && r.name < own));
      if (!ahead) {
        stage = 'mutex-create';
        try {
          attempt();
          try { io(stage, () => fs.mkdirSync(mutex, { mode: 0o700 })); }
          catch (error) { note(error, 'mutex-acquire');throw error; }
          createdMutex = true;mutexIdentity = directory(mutex);
          within();
          return () => { removeMutex();removeOwn(); };
        } catch (error) {
          if (createdMutex || (error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          busy = error;
        }
      } else { stage = 'queue-wait';busy = expired(stage); }
      if (performance.now() >= deadline) throw busy;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1);
    }
  } catch (primary) {
    // Unidentified acquisitions stay closed. Only this operation's proven objects may be retired.
    if (createdMutex && !mutexIdentity || !identity || publishing && !ticketIdentity) throw primary;
    try { if (createdMutex) removeMutex();removeOwn(); }
    catch (cleanup) { throw new AggregateError([primary, cleanup], 'Mutex acquisition and cleanup failed'); }
    throw primary;
  }
}
