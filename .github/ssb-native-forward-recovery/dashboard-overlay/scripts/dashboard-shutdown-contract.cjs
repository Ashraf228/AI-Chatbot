'use strict';
const SOURCE = '94a25578e883a6d7bbd03f26c56735739f75e45e';
const LIMIT = 7000;
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const fields = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
  && same(Object.keys(v).sort(), [...keys].sort());
function need(ok) { if (!ok) throw Object.assign(new Error('dashboard_shutdown_unverified'), {code:'dashboard_shutdown_unverified'}); }
function binding(b) {
  need(fields(b,['version','run','source','publication','service','generation','participant','imageId'])
    && ['run','source','publication','service','generation','participant','imageId'].every(k=>typeof b[k]==='string')
    && b.version === 1 && /^[1-9][0-9]*$/.test(b.run) && Number.isSafeInteger(Number(b.run))
    && b.source === SOURCE && /^[a-f0-9]{64}$/.test(b.publication)
    && b.service === 'ssb-native-' + b.run && ['release','forward','normal'].includes(b.generation)
    && b.participant === `${b.service}-${b.generation}-dashboard`
    && /^sha256:[a-f0-9]{64}$/.test(b.imageId));
  return b;
}
const stages = ['startup','admission','http','work','next','redis','verify','receipt'];
const reasons = ['unknown','deadline','work_uncertain','http_close_failed','next_close_failed',
  'next_task_failed','redis_close_failed','request_failed','binding_invalid','receipt_failed','EACCES','EIO','ENOSPC'];
function validate(r, expected) {
  need(fields(r,['version','binding','status','signal','admissionClosed','remainingWork','httpClosed','nextClosed',
    'redisClosed','redisClients','recordedAt','elapsedMs','failure','secondary']));
  binding(r.binding); if (expected) { binding(expected); need(same(r.binding,expected)); }
  need(r.version===1 && ['graceful','failed'].includes(r.status) && ['SIGTERM','SIGINT'].includes(r.signal)
    && ['admissionClosed','httpClosed','nextClosed','redisClosed'].every(k=>typeof r[k]==='boolean')
    && Number.isInteger(r.remainingWork) && r.remainingWork>=0 && r.remainingWork<=10000
    && Number.isInteger(r.redisClients) && r.redisClients>=0 && r.redisClients<=16
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(r.recordedAt) && Number.isFinite(Date.parse(r.recordedAt))
    && Number.isFinite(r.elapsedMs) && r.elapsedMs>=0 && r.elapsedMs<=LIMIT+1000
    && Array.isArray(r.secondary) && r.secondary.length<=4);
  const point = p => need(fields(p,['stage','code']) && stages.includes(p.stage) && reasons.includes(p.code));
  r.secondary.forEach(point);
  if (r.status==='graceful') need(r.failure===null && r.secondary.length===0 && r.admissionClosed
    && r.remainingWork===0 && r.httpClosed && r.nextClosed && r.redisClosed && r.elapsedMs<LIMIT);
  else { point(r.failure); }
  return r;
}
function completed(r, expected, state) {
  validate(r,expected);
  need(r.status==='graceful' && state?.Status==='exited' && state.Running===false
    && state.Paused===false && state.Restarting===false && state.OOMKilled===false && !state.Error
    && state.Dead!==true && state.ExitCode===0 && Number.isFinite(Date.parse(state.StartedAt))
    && Date.parse(r.recordedAt)>=Date.parse(state.StartedAt) && Date.parse(r.recordedAt)<=Date.parse(state.FinishedAt));
  return r;
}
module.exports={SOURCE,LIMIT,binding,validate,completed,stages,reasons};
