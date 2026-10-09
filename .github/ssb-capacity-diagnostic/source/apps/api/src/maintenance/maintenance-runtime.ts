import { AsyncLocalStorage } from 'node:async_hooks';
import { ServiceUnavailableException, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { NextFunction, Request, Response } from 'express';
import { MaintenanceDenied, MaintenanceState, WorkKind } from './maintenance-state';

type Context = { state: MaintenanceState; id?: string; owner?: string; epoch?: number };
const context = new AsyncLocalStorage<Context>();
const localContext = new AsyncLocalStorage<boolean>();
let stopping = false, localActive = 0, localUncertain = false;
export function requestMaintenanceShutdown() {
  stopping = true;
  return runtimeState()?.stopAdmission();
}
export function maintenanceShutdownStatus() {
  const work = runtimeState()?.processWorkStatus();
  return { pending: localActive + (work?.running ?? 0), uncertain: localUncertain || Boolean(work?.uncertain) };
}
function assertLocalAdmission() {
  if (stopping && !localContext.getStore() && !context.getStore()?.id) throw new MaintenanceDenied('process_stopping');
}
let cached: { key: string; state: MaintenanceState } | undefined;

export function runtimeState(): MaintenanceState | undefined {
  const root = process.env.MAINTENANCE_STATE_ROOT;
  const service = process.env.MAINTENANCE_SERVICE;
  const generation = process.env.MAINTENANCE_GENERATION;
  if (!root && !service && !generation && process.env.APP_ENV !== 'production') return undefined;
  if (!root || !service || !generation) throw new MaintenanceDenied('binding_missing');
  const key = JSON.stringify([root, service, generation]);
  if (cached?.key !== key) cached = { key, state: new MaintenanceState({ root, service, generation }) };
  return cached.state;
}

export function assertMaintenanceBootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.APP_ENV) throw new MaintenanceDenied('deployment_environment_missing');
  const state = runtimeState(), snapshot = state?.snapshot();
  if (snapshot?.deployment && snapshot.deployment.generation !== state!.binding.generation) throw new MaintenanceDenied('generation_retired');
}

export class MaintenanceInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler) {
    return new Observable((subscriber) => {
      // Do not equate an HTTP unsubscribe with completion of the controller promise.
      void maintenanceWork('handler', () => new Promise<void>((resolve, reject) => {
        next.handle().subscribe({ next: (value) => subscriber.next(value), error: reject, complete: resolve });
      })).then(() => subscriber.complete(), (error) => subscriber.error(error));
    });
  }
}

// Host-only capability propagation. Never populate this context from an HTTP header/claim.
export async function withMaintenanceOwner<T>(owner: string, callback: () => Promise<T>, expectedEpoch?: number) {
  const state = runtimeState();
  if (!state) throw new MaintenanceDenied('binding_missing');
  state.assertOwner(owner);
  const epoch = expectedEpoch ?? state.snapshot().epoch;
  state.assertEpoch(owner, epoch);
  return context.run({ state, owner, epoch }, callback);
}

export function assertCurrentMaintenanceOwner() {
  const current = context.getStore();
  if (current?.owner) current.state.assertEpoch(current.owner, current.epoch!);
}

export async function maintenanceWork<T>(kind: WorkKind, callback: () => Promise<T>, external = false): Promise<T> {
  return localMaintenanceWork(() => registeredWork(kind, callback, external));
}

// The signed writer request supplies its owner inside execute(), not at HTTP admission.
export async function localMaintenanceWork<T>(callback: () => Promise<T>): Promise<T> {
  assertLocalAdmission();
  localActive++;
  try { return await localContext.run(true, callback); }
  finally { localActive--; }
}

async function registeredWork<T>(kind: WorkKind, callback: () => Promise<T>, external: boolean): Promise<T> {
  const state = runtimeState();
  if (!state) return callback();
  const previous = context.getStore();
  const parent = previous?.state === state ? previous.id : undefined;
  const owner = previous?.state === state ? previous.owner : undefined;
  const epoch = owner ? previous?.epoch : undefined;
  const id = state.begin(kind, parent, owner, epoch);
  let result: T;
  try { result = await context.run({ state, id, owner, epoch }, callback); }
  catch (primary) {
    try { state.end(id, external); }
    catch (cleanup) { throw new AggregateError([primary, cleanup], 'Work and maintenance accounting failed'); }
    throw primary;
  }
  state.end(id);
  return result;
}

export function MaintenanceWork(kind: WorkKind, external = false): MethodDecorator {
  return (_target, _property, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      return maintenanceWork(kind, () => original.apply(this, args), external);
    };
  };
}

export function observeWorkerKickoff(work: Promise<unknown>): void {
  void work.catch((error) => {
    // A denied kickoff leaves queued jobs untouched. Never turn it into an unhandled rejection.
    if (error instanceof MaintenanceDenied) return;
    console.error('background_work_failed');
  });
}

// Called only with the loaded site's identity, in addition to the existing pilot/access guards.
export function assertMaintenancePilotScope(scope: { tenantId?: string | null; siteId: string }) {
  const current = context.getStore();
  if (current?.id) current.state.confirmPilotScope(current.id, scope.tenantId, scope.siteId);
}

export function maintenanceIngress(req: Request, res: Response, next: NextFunction) {
  let state: MaintenanceState | undefined;
  let id: string;
  try {
    if (stopping) throw new MaintenanceDenied('process_stopping');
    state = runtimeState();
    if (state) id = state.beginPilotRequest({ method: req.method, route: req.originalUrl || req.url,
      siteKey: req.body?.siteKey, message: req.body?.message, token: req.headers?.['x-site-pilot-token'] });
  } catch { return next(new ServiceUnavailableException('Dienst derzeit nicht verfuegbar.')); }
  let ended = false;
  localActive++;
  let uncertainSeen = false;
  const end = (uncertain: boolean) => {
    uncertainSeen ||= uncertain;
    if (ended) return;
    try { state?.end(id, uncertainSeen); ended = true; localActive--; if (uncertainSeen) localUncertain = true; }
    catch { localUncertain = true; console.error('maintenance_completion_unverified'); }
  };
  res.once('finish', () => end(false));
  res.once('close', () => end(!res.writableFinished));
  req.once('aborted', () => end(true));
  localContext.run(true, () => state ? context.run({ state, id }, next) : next());
}

/** Headers are NOT completion. Track the actual response body through EOF/cancel/error. */
export async function maintenanceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<globalThis.Response> {
  assertLocalAdmission();
  const state = runtimeState();
  if (!state) return globalThis.fetch(input, init);
  const previous = context.getStore();
  let dispatch: { purpose: 'query_embedding' | 'llm_generation'; model: string } | undefined;
  try {
    const url = new URL(input instanceof globalThis.Request ? input.url : String(input));
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (url.origin === 'https://api.openai.com' && !url.username && !url.password && !url.search && !url.hash
      && init?.method?.toUpperCase() === 'POST' && typeof body?.model === 'string' && body.stream !== true) {
      if (url.pathname === '/v1/embeddings') dispatch = { purpose: 'query_embedding', model: body.model };
      if (url.pathname === '/v1/chat/completions') dispatch = { purpose: 'llm_generation', model: body.model };
    }
  } catch { /* An unclassified dispatch is denied in a pilot, not silently classified. */ }
  const id = state.beginDispatch(previous?.state === state ? previous.id : undefined, previous?.owner, dispatch);
  let ended = false;
  let uncertainSeen = false;
  // A journal error after observed EOF is not a second, uncertain transport outcome.
  const end = (uncertain: boolean) => { uncertainSeen ||= uncertain; if (!ended) { ended = true; state.end(id, uncertainSeen); } };
  try {
    const response = await globalThis.fetch(input, init);
    // Known failure must block another dispatch even if the caller never reads its body.
    if (!response.ok) end(true);
    if (!response.body) { end(!response.ok); return response; }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const value = await reader.read();
          if (value.done) { end(!response.ok); controller.close(); }
          else controller.enqueue(value.value);
        } catch (error) {
          try { end(true); } catch (cleanup) { error = new AggregateError([error, cleanup], 'Provider completion unknown'); }
          controller.error(error);
        }
      },
      async cancel(reason) {
        let primary: unknown;
        try { await reader.cancel(reason); }
        catch (error) { primary = error; throw error; }
        finally {
          try { end(true); }
          catch (cleanup) {
            if (primary !== undefined) throw new AggregateError([primary, cleanup], 'Provider cancellation unknown');
            throw cleanup;
          }
        }
      },
    }, { highWaterMark: 0 });
    return new globalThis.Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (primary) {
    try { end(true); } catch (cleanup) { throw new AggregateError([primary, cleanup], 'Provider completion unknown'); }
    throw primary;
  }
}
