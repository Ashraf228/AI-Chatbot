import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

type Kind = 'worker' | 'job' | 'handler' | 'provider';
type State = { begin(kind: Kind, parent?: string): string; end(id: string, uncertain?: boolean): void;
  stopAdmission(): number; processWorkStatus(): { running: number; uncertain: number } };
const context = new AsyncLocalStorage<{ state: State; id: string }>();
let cached: { key: string; state: State } | undefined;
let stopping = false;

function state(): State | undefined {
  const root = process.env.MAINTENANCE_STATE_ROOT, service = process.env.MAINTENANCE_SERVICE,
    generation = process.env.MAINTENANCE_GENERATION;
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ENV) throw Error('Reporter environment binding missing');
  if (!root && !service && !generation && process.env.APP_ENV !== 'production') return undefined;
  if (!root || !service || !generation) throw Error('Reporter maintenance binding missing');
  const key = JSON.stringify([root, service, generation]);
  if (cached?.key !== key) {
    const { MaintenanceState } = createRequire(import.meta.url)('../dist/maintenance-state.cjs');
    cached = { key, state: new MaintenanceState({ root, service, generation }) };
  }
  return cached!.state;
}

async function trackedWork<T>(kind: Kind, action: () => Promise<T>, onClosed?: () => T): Promise<T> {
  const bound = state();
  if (!bound) return action();
  const prior = context.getStore();
  let id: string;
  try {
    if (stopping && (kind === 'job' || !prior)) {
      const { MaintenanceDenied } = createRequire(import.meta.url)('../dist/maintenance-state.cjs');
      throw new MaintenanceDenied('admission_closed');
    }
    id = bound.begin(kind, prior?.state === bound ? prior.id : undefined);
  }
  catch (error) {
    const { MaintenanceDenied } = createRequire(import.meta.url)('../dist/maintenance-state.cjs');
    // Only the admission step may end a queue loop cleanly. Never classify action errors here.
    if (kind === 'job' && onClosed && error instanceof MaintenanceDenied
      && (error as { code: string }).code === 'admission_closed') return onClosed();
    throw error;
  }
  return perform(bound, id, action);
}

async function perform<T>(bound: State, id: string, action: () => Promise<T>): Promise<T> {
  let result: T;
  try { result = await context.run({ state: bound, id }, action); }
  catch (primary) {
    try { bound.end(id, true); }
    catch (cleanup) { throw new AggregateError([primary, cleanup], 'Reporter completion unverified'); }
    throw primary;
  }
  bound.end(id);
  return result;
}

/** Closed generations stay alive without work; only the existing journal can admit a job. */
export async function reporterEntry(action: () => Promise<void>): Promise<void> {
  const bound = state();
  if (!bound) return action();
  const { MaintenanceDenied } = createRequire(import.meta.url)('../dist/maintenance-state.cjs');
  let timer: ReturnType<typeof setTimeout> | undefined, stoppedAt: number | undefined;
  let stopError: unknown;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    stoppedAt = performance.now();
    timer = setTimeout(() => {
      process.stderr.write('{"event":"reporter_shutdown_failed","reason":"shutdown_deadline","graceful":false}\n');
      process.exit(1);
    }, 7000);
    try { bound.stopAdmission(); } catch (error) { stopError = error; }
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  try {
    while (!stopping) {
      let id: string;
      try { id = bound.begin('worker'); }
      catch (error) {
        // Retry admission only. An identically shaped error from an admitted action is fatal.
        if (!(error instanceof MaintenanceDenied) || (error as { code: string }).code !== 'admission_closed') throw error;
        await delay(25);
        continue;
      }
      await perform(bound, id, action);
      break;
    }
    if (stopError) throw stopError;
    const work = bound.processWorkStatus();
    if (work.running || work.uncertain || (stoppedAt !== undefined && performance.now() - stoppedAt >= 7000)) {
      throw Error('Reporter completion unverified');
    }
    if (stopping) process.stdout.write('{"event":"reporter_shutdown_complete","graceful":true}\n');
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  }
}

export function reporterWork<T>(kind: Kind, action: () => Promise<T>): Promise<T> {
  return trackedWork(kind, action);
}

export function reporterJob(action: () => Promise<void>): Promise<boolean> {
  return trackedWork('job', async () => { await action(); return true; }, () => false);
}

export function reporterJson<T>(url: string, init: RequestInit): Promise<T> {
  return reporterWork('handler', async () => {
    const response = await fetch(url, init);
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(`Reporter API request failed: ${response.status}`);
    }
    return await response.json() as T;
  });
}
