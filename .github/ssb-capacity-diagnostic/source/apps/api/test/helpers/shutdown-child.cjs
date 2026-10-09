// Real Nest lifecycle and OS signals; only database/Redis transports are synthetic.
require('reflect-metadata');
const Module=require('node:module'),{EventEmitter}=require('node:events');
const mode=process.argv[2],load=Module._load,events=[];
const ActualRedis=require('ioredis'),{closeHandler}=require('ioredis/built/redis/event_handler');
const {PassThrough}=require('node:stream');
class Pool extends EventEmitter {
  totalCount=1;
  async query() {
    process.send({working:true});
    if(mode==='hang-work')return new Promise(()=>{});
    await new Promise(r=>setTimeout(r,300));events.push('work-finished');return {rows:[]};
  }
  async end() {
    events.push('pg-close');
    if(mode==='pool-failure')throw Error('synthetic-private-connection-string');
    if(mode==='hang-pool')return new Promise(()=>{});
    await new Promise(r=>setTimeout(r,20));this.totalCount=0;events.push('pg-closed');
  }
}
class Redis extends EventEmitter {
  constructor() {
    super();
    if(mode==='redis-quit-race') {
      const redis=new ActualRedis({lazyConnect:true});redis.status='ready';redis.condition={select:0};redis.stream=new PassThrough();
      const quit=redis.quit.bind(redis);
      redis.quit=()=>{events.push('redis-close');const p=quit();setImmediate(()=>closeHandler(redis)());return p;};
      redis.on('end',()=>events.push('redis-closed'));return redis;
    }
  }
  async quit() {
    events.push('redis-close');await new Promise(r=>setTimeout(r,10));
    if(mode==='redis-hang')return new Promise(()=>{});
    events.push('redis-closed');this.emit('end');
    if(mode==='redis-quit-failure')throw Error('synthetic-private-redis-connection');
    return 'OK';
  }
}
Module._load=function(id,...args){if(id==='pg')return {Pool};if(id==='ioredis')return Redis;return load.call(this,id,...args);};
const {DatabaseService,closeDatabasePools,databasePoolsClosed}=require('../../dist/db/database.service');
const {RateLimitService}=require('../../dist/utils/rate-limit.service');
const {maintenanceIngress,maintenanceWork}=require('../../dist/maintenance/maintenance-runtime');
const {installGracefulShutdown}=require('../../dist/maintenance/graceful-shutdown');
const {Module: NestModule}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');
class TestModule {}
NestModule({providers:[DatabaseService,RateLimitService]})(TestModule);
(async()=>{
  const app=await NestFactory.create(TestModule,{logger:false});
  app.use(maintenanceIngress);
  app.getHttpAdapter().get('/work',async(_req,res)=>{try{await app.get(DatabaseService).query('synthetic-only');res.end('completed');}catch{res.status(503).end('denied');}});
  app.getHttpAdapter().get('/check',(_req,res)=>res.end('accepted'));
  const controller=installGracefulShutdown('api',{
    close:async()=>{events.push('app-close');await app.close();await closeDatabasePools();events.push('app-closed');},
    poolsClosed:()=>databasePoolsClosed(),
  });
  if(mode==='uncertain')await maintenanceWork('provider',async()=>{throw Error('synthetic-private-payload');},true).catch(()=>{});
  await app.listen(0,'127.0.0.1');
  process.on('exit',()=>process.stdout.write(JSON.stringify({events})+'\n'));
  process.send({ready:true,port:app.getHttpServer().address().port});
  if(mode==='direct')await controller.stop();
})().catch(error=>{console.error('synthetic_start_failed',JSON.stringify({name:error.name,code:error.code,
  frames:String(error.stack||'').split('\n').slice(1,5)}));process.exit(2);});
