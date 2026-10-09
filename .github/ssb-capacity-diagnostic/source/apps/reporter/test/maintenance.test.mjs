import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import nodemailer from 'nodemailer';
import { generateWeeklyReports } from '../dist/jobs/generateWeeklyReports.js';
import { generateMonthlyReports } from '../dist/jobs/generateMonthlyReports.js';
import { sendLeadDigest } from '../dist/jobs/sendLeadDigest.js';
import { MailerService } from '../dist/services/mailer.service.js';
import { ReportAggregatorService } from '../dist/services/reportAggregator.service.js';
import { reporterJob, reporterJson } from '../dist/maintenance.js';
const { MaintenanceDenied, MaintenanceState } = createRequire(import.meta.url)('../dist/maintenance-state.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-maintenance-'));
  fs.chmodSync(root, 0o700);
  const env = { APP_ENV:'production', NODE_ENV:'production', MAINTENANCE_STATE_ROOT:root,
    MAINTENANCE_SERVICE:'synthetic-api', MAINTENANCE_GENERATION:'g1',
    REPORTER_API_BASE_URL:'https://api.example.test', REPORTER_API_TOKEN:'synthetic-read-only-reporter-test-token',
    REPORTER_SITE_BINDINGS:JSON.stringify([1,2].map(n=>({tenantId:'synthetic',siteId:`synthetic-${n}`}))),
    SMTP_HOST:'smtp.example.test', SMTP_USER:'synthetic', SMTP_PASS:'synthetic' };
  const old = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  fs.writeFileSync(path.join(root,'runtime-state.json'),JSON.stringify({version:1,service:'synthetic-api',generations:['g1'],epoch:0,phase:'open',legacy:'new-empty-service',work:{}}),{mode:0o600});
  const state = new MaintenanceState({root,service:'synthetic-api',generation:'g1'}), owner = 'b'.repeat(64);
  const close = () => {
    fs.mkdirSync(path.join(root,'maintenance-window'),{mode:0o700});
    fs.writeFileSync(path.join(root,'maintenance-window/owner.json'),JSON.stringify({version:1,owner}),{mode:0o600});
    return state.close(owner);
  };
  const fetch = globalThis.fetch, transport = nodemailer.createTransport;
  t.after(() => {
    globalThis.fetch=fetch; nodemailer.createTransport=transport;
    for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;
    fs.rmSync(root,{recursive:true});
  });
  return {state,owner,close};
}

for(const [name, action]of Object.entries({weekly:generateWeeklyReports, monthly:generateMonthlyReports, digest:sendLeadDigest,
  mail:()=>new MailerService().send({to:'synthetic@example.test',subject:'test'}),
  aggregate:()=>new ReportAggregatorService().aggregate({frequency:'weekly',siteId:'synthetic',recipientEmail:'synthetic@example.test'})})) {
  test(`reporter ${name} refuses closed admission before API or SMTP`, async t => {
    const f=fixture(t); f.close(); let external=0;
    globalThis.fetch=async()=>{external++;throw Error('unexpected transport')};
    nodemailer.createTransport=()=>{external++;throw Error('unexpected transport')};
    await assert.rejects(action);
    assert.equal(external,0);
  });
}

for(const [frequency, action]of [['weekly',generateWeeklyReports],['monthly',generateMonthlyReports]]) {
  test(`reporter ${frequency} preserves next subscription after active job and close`,async t=>{
    const f=fixture(t);let sent=0, requests=0;
    globalThis.fetch=async(url)=>{
      requests++;
      if(url.includes('/report-subscriptions?siteId='))return Response.json([{siteId:new URL(url).searchParams.get('siteId'),recipientEmail:'synthetic@example.test',frequency,isEnabled:true}]);
      return Response.json({});
    };
    nodemailer.createTransport=()=>({sendMail:async()=>{sent++;f.close();return {messageId:'synthetic'}}});
    await action();
    assert.equal(sent,1);assert.equal(requests,5);
    assert.equal(Object.values(f.state.snapshot().work).filter(w=>w.kind==='job').length,1);
    assert.equal(f.state.drained(f.owner, f.state.snapshot().epoch).completed, true);
  });
}

test('reporter unknown SMTP outcome prevents another dispatch, even after process-local callback ends',async t=>{
  fixture(t);let sent=0;
  nodemailer.createTransport=()=>({sendMail:async()=>{sent++;throw Error('synthetic lost reply')}});
  const send=()=>new MailerService().send({to:'synthetic@example.test',subject:'test'});
  await assert.rejects(send);await assert.rejects(send);assert.equal(sent,1);
});

test('reporter production binding is mandatory before direct SMTP',async t=>{
  fixture(t);delete process.env.MAINTENANCE_STATE_ROOT;let dispatched=0;
  nodemailer.createTransport=()=>{dispatched++;throw Error('unexpected')};
  await assert.rejects(()=>new MailerService().send({to:'synthetic@example.test',subject:'test'}));
  assert.equal(dispatched,0);
});

test('reporter API completion includes the response body, not only its headers', async t => {
  const f = fixture(t);
  let finishBody, entered;
  const reading = new Promise(resolve => { entered = resolve; });
  globalThis.fetch = async () => ({ ok: true, json: () => {
    entered();
    return new Promise(resolve => { finishBody = resolve; });
  } });
  const pending = reporterJson('https://api.example.test/synthetic', {});
  await reading;
  const epoch = f.close();
  try { assert.throws(() => f.state.drained(f.owner, epoch)); }
  finally { finishBody({ synthetic: true }); }
  assert.deepEqual(await pending, { synthetic: true });
  assert.equal(f.state.drained(f.owner, epoch).completed, true);
});

test('reporter journal is compiled from the exact shared API protocol source', () => {
  const require = createRequire(import.meta.url), ts = require('typescript');
  const source = fs.readFileSync(new URL('../../api/src/maintenance/maintenance-state.ts', import.meta.url), 'utf8');
  const expected = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  }).outputText;
  assert.equal(fs.readFileSync(new URL('../dist/maintenance-state.cjs', import.meta.url), 'utf8'), expected);
});

test('an admission-shaped error from an already started reporter job is never swallowed as a clean stop', async t => {
  const f = fixture(t);
  await assert.rejects(() => reporterJob(async () => { throw new MaintenanceDenied('admission_closed'); }), { code: 'admission_closed' });
  const epoch = f.close();
  assert.equal(Object.values(f.state.snapshot().work)[0].state, 'uncertain');
  assert.throws(() => f.state.drained(f.owner, epoch));
});
