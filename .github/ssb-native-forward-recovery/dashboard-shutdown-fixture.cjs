'use strict';
// Synthetic complete shutdown evidence for offline controller/receiver regressions only.
const {sha}=require('./common.cjs');
function attach(data,run){
  const source=require('./controller.cjs').SOURCE,publication=data.preflight.hashes[0];
  data.builds.hashes=[require('./reporter-source.cjs').manifest().hash,require('./dashboard-source.cjs').manifest().hash,require('./api-source.cjs').manifest().hash];
  for(const generation of ['release','forward','normal']){
    const row=data[generation+'-shutdown'];if(!row)continue;
    const dashboardShutdown={version:1,binding:{version:1,run,source,publication,service:'ssb-native-'+run,generation,
      participant:`ssb-native-${run}-${generation}-dashboard`,imageId:data.builds.ids[1]},status:'graceful',signal:'SIGTERM',
      admissionClosed:true,remainingWork:0,httpClosed:true,nextClosed:true,redisClosed:true,redisClients:1,
      recordedAt:'2026-10-10T00:00:00.500Z',elapsedMs:100,failure:null,secondary:[]};
    row.hashes=[...row.hashes.slice(0,2),sha(JSON.stringify(dashboardShutdown))];
    row.detail={failure:null,outcomes:[],dashboardShutdown};
  }
  for(const o of data.closure?.detail?.outcomes||[])if(o.role==='dashboard'&&o.exit===0){o.state='graceful';for(const s of [o.observation.before,o.observation.after]){s.startedAt='2026-10-10T00:00:00.000Z';s.finishedAt='2026-10-10T00:00:01.000Z';}}
  return data;
}
function observeClosure(row){for(const o of row.detail.outcomes)if(o.role==='dashboard')for(const s of [o.observation.before,o.observation.after])s.observedAt=new Date().toISOString();return row;}
module.exports={attach,observeClosure};
