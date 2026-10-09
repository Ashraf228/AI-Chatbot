import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { maintenanceShutdownStatus, requestMaintenanceShutdown, runtimeState } from './maintenance-runtime';

export const SHUTDOWN_LIMIT_MS = 7000;
type Hooks = { close: () => Promise<void>; poolsClosed: () => boolean };

/** Must fit inside the existing eight-second external stop limit; never extends it. */
export function installGracefulShutdown(component: 'api' | 'admin-writer', hooks: Hooks) {
  const state = runtimeState();
  const participant = process.env.MAINTENANCE_PARTICIPANT_ID;
  const imageId = process.env.MAINTENANCE_IMAGE_ID;
  let receipt: string | undefined;
  if (state) {
    if (!participant || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(participant)
      || !/^sha256:[a-f0-9]{64}$/.test(imageId || '')) throw new Error('shutdown_identity_missing');
    receipt = path.join(state.binding.root, `shutdown-${participant}.json`);
    try { fs.lstatSync(receipt); throw new Error('shutdown_identity_reused'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  let completion: Promise<void> | undefined;
  const stop = () => completion ??= (async () => {
    const start = performance.now();
    let stage = 'admission';
    const fail = (error?: unknown) => {
      // No error messages, argv, connection strings or provider data enter this diagnostic.
      const reason = (error as { code?: unknown })?.code === 'redis_quit_failed' ? 'redis_quit_failed'
        : error === undefined ? 'shutdown_deadline' : 'shutdown_error';
      process.stderr.write(JSON.stringify({ event: 'shutdown_failed', component, stage, reason, graceful: false }) + '\n');
      process.exit(1);
    };
    const timer = setTimeout(fail, SHUTDOWN_LIMIT_MS);
    const withinDeadline = () => {
      if (performance.now() - start >= SHUTDOWN_LIMIT_MS) throw new Error('shutdown_deadline');
    };
    try {
      requestMaintenanceShutdown();
      stage = 'drain';
      for (;;) {
        withinDeadline();
        const status = maintenanceShutdownStatus();
        if (status.uncertain) throw new Error('work_completion_unverified');
        if (!status.pending) break;
        await delay(10);
      }
      stage = 'close';
      await hooks.close();
      withinDeadline();
      stage = 'verify';
      const status = maintenanceShutdownStatus();
      if (status.pending || status.uncertain || !hooks.poolsClosed()) throw new Error('closure_unverified');
      stage = 'receipt';
      if (receipt) {
        const fd = fs.openSync(receipt, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        try {
          fs.writeFileSync(fd, JSON.stringify({ version: 1, status: 'graceful', component,
            service: state!.binding.service, generation: state!.binding.generation,
            participant, imageId, remainingWork: 0, poolsClosed: true,
            recordedAt: new Date().toISOString(), elapsedMs: performance.now() - start }));
          fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
        const directory = fs.openSync(state!.binding.root, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
      }
      withinDeadline();
      clearTimeout(timer);
      process.stdout.write(JSON.stringify({ event: 'shutdown_complete', component, graceful: true }) + '\n');
      // Pool close and application close have already resolved. This is not the timeout path.
      process.exit(0);
    } catch (error) { clearTimeout(timer); fail(error); }
  })();
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return { stop };
}
