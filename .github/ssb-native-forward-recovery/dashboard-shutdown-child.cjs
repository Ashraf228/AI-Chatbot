'use strict';
// Synthetic process fixture: no sockets, provider clients or application data.
const {createLifecycle}=require('./dashboard-overlay/scripts/dashboard-lifecycle.cjs');
const contract=require('./dashboard-shutdown-contract.cjs');
const binding={version:1,run:'12345678',source:contract.SOURCE,publication:'a'.repeat(64),service:'ssb-native-12345678',generation:'release',participant:'ssb-native-12345678-release-dashboard',imageId:'sha256:'+'b'.repeat(64)};
const mode=process.argv[2];if(!['success','hang','primary-hang'].includes(mode))throw Error('fixture binding');
const lifecycle=createLifecycle({binding,receipt:'/synthetic-not-written',state:{stopAdmission(){},processWorkStatus(){return{running:0,uncertain:0};}},server:{listening:false},handle:async()=>{},upgrade:async()=>{},closeNext:mode==='success'?async()=>{}:()=>new Promise(()=>{}),write(){}});
if(mode==='primary-hang')lifecycle.capture(Object.assign(Error(),{code:'request_failed'}),'work');
process.on('SIGTERM',()=>{void lifecycle.stop('SIGTERM');});
process.stdout.write('READY\n');setInterval(()=>{},1000);
