'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const contract=require('./dashboard-shutdown-contract.cjs');
const {createLifecycle}=require('./dashboard-lifecycle.cjs');
const {closeNextStrict,bindWaitUntil,bindErrorSink}=require('./dashboard-next-close.cjs');
let activeLifecycle;
async function main() {
  if(process.version!=='v24.17.0'||process.env.NODE_ENV!=='production'||process.env.APP_ENV!=='production'
    ||process.env.HOSTNAME!=='0.0.0.0'||process.env.PORT!=='3000') throw Error('binding_invalid');
  const binding=contract.binding(JSON.parse(process.env.SSB_DASHBOARD_SHUTDOWN_BINDING||'null'));
  if(process.env.MAINTENANCE_STATE_ROOT!=='/run/ssb-maintenance'||process.env.MAINTENANCE_SERVICE!==binding.service
    ||process.env.MAINTENANCE_GENERATION!==binding.generation)throw Error('binding_invalid');
  const {MaintenanceState}=require('./maintenance-state.cjs');
  const state=new MaintenanceState({root:process.env.MAINTENANCE_STATE_ROOT,service:binding.service,generation:binding.generation});
  const receipt=path.join(state.binding.root,`shutdown-${binding.participant}.json`);
  try{fs.lstatSync(receipt);throw Error('binding_invalid');}catch(e){if(e.code!=='ENOENT')throw e;}
  const dir=path.resolve(__dirname,'..');process.chdir(dir);
  if(require('next/package.json').version!=='16.3.8')throw Error('binding_invalid');
  const config=JSON.parse(fs.readFileSync(path.join(dir,'.next/required-server-files.json'),'utf8')).config;
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG=JSON.stringify(config);
  const server=http.createServer();let app,ready;
  const lifecycle=createLifecycle({binding,state,server,receipt,
    handle:(...args)=>app.requestHandler(...args),upgrade:(...args)=>app.upgradeHandler(...args),
    closeUpgraded:async()=>{await ready;await app.closeUpgraded();},closeNext:async()=>{await ready;await closeNextStrict(app.server,require('next/dist/server/lib/async-callback-set').AsyncCallbackSet,lifecycle.capture);}});
  activeLifecycle=lifecycle;
  bindErrorSink(console,lifecycle.capture,line=>{const b=Buffer.from(line);if(fs.writeSync(2,b)!==b.length)throw Object.assign(Error('receipt_failed'),{code:'receipt_failed'});});
  globalThis.__ssbDashboardLifecycle__=lifecycle;
  process.on('SIGTERM',()=>{void lifecycle.stop('SIGTERM');});process.on('SIGINT',()=>{void lifecycle.stop('SIGINT');});
  server.on('request',lifecycle.request);server.on('upgrade',lifecycle.upgraded);
  // Own the HTTP server and signals. Do not invoke Next's startServer signal-to-exit-143 handler.
  ready=require('next/dist/server/lib/start-server').getRequestHandlers({dir,port:3000,hostname:'0.0.0.0',isDev:false,server});
  app=await ready;
  if(!app||typeof app.requestHandler!=='function'||typeof app.upgradeHandler!=='function'
    ||typeof app.closeUpgraded!=='function'||typeof app.server?.close!=='function')throw Error('binding_invalid');
  bindWaitUntil(app.server,require('next/dist/server/after/awaiter').AwaiterOnce,lifecycle.capture);
  if(lifecycle.stopping)return;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3000,'0.0.0.0',resolve);});
}
if(require.main===module)main().catch(error=>{activeLifecycle?.capture(error,'startup');process.stderr.write('SSB_DASHBOARD_START_FAILED\n');process.exitCode=1;});
module.exports={main};
