'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
function publicConfig(config){
 const strings=['siteId','siteKey','publicKey','apiBase','title','greeting','placeholder','buttonText','position','widgetBundleUrl','companyName','botName','logoUrl','privacyUrl','domain'];
 const booleans=['consentRequired','leadCaptureEnabled','isActive'];
 assert.ok(config&&typeof config==='object'&&!Array.isArray(config));
 assert.deepEqual(Object.keys(config).sort(),[...strings,...booleans,'theme','suggestedQuestionsByPath'].sort());
 for(const key of strings)assert.equal(typeof config[key],'string');
 for(const key of booleans)assert.equal(typeof config[key],'boolean');
 assert.equal(config.siteId,'synthetic-site');assert.equal(config.siteKey,'synthetic-key');assert.equal(config.isActive,true);
 assert.equal(config.domain,'synthetic.invalid');assert.equal(config.apiBase,'https://api.synthetic.invalid');assert.equal(config.widgetBundleUrl,'https://widget.synthetic.invalid/widget.js');
 assert.equal(config.greeting,'Synthetic widget greeting');assert.equal(config.position,'bottom-right');
 assert.ok(config.theme&&typeof config.theme==='object');assert.deepEqual(Object.keys(config.theme).sort(),['accentColor','brandColor','fontFamily']);
 for(const value of Object.values(config.theme))assert.equal(typeof value,'string');assert.equal(config.theme.brandColor,'#123456');
 assert.ok(config.suggestedQuestionsByPath&&typeof config.suggestedQuestionsByPath==='object'&&!Array.isArray(config.suggestedQuestionsByPath));
 for(const [key,questions] of Object.entries(config.suggestedQuestionsByPath)){assert.ok(key.startsWith('/'));assert.ok(Array.isArray(questions)&&questions.every(q=>typeof q==='string'));}
 const scan=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){assert.ok(!/^(tenantid|systemprompt|leadnotificationemail|conversationflow|config|authorization|apikey|password|secret|token|providerapprovalgrants)$/.test(key.replace(/[^a-z0-9]/gi,'').toLowerCase()),'Forbidden public field');scan(child);}};
 scan(config);
 for(const marker of ['synthetic-private-prompt','private@example.invalid','syntheticPrivate'])assert.ok(!JSON.stringify(config).includes(marker),'Private fixture leaked');
}
async function verifyWidget({fetchImpl=fetch,commit,buildDate,base='http://ssb-e1-uhqfnw-widget:80',api='http://ssb-e1-uhqfnw-api:5000'}){
 const checks=[];
 const get=async(url,max=2*1024*1024,headers={})=>{
  const r=await fetchImpl(url,{headers,redirect:'error',signal:AbortSignal.timeout(3000)}),chunks=[];let size=0;
  const reader=r.body.getReader();try{for(;;){const v=await reader.read();if(v.done)break;size+=v.value.length;assert.ok(size<=max,'Bounded response required');chunks.push(Buffer.from(v.value));}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return {status:r.status,headers:r.headers,body:Buffer.concat(chunks)};
 };
 const health=await get(base+'/healthz',32);assert.equal(health.status,200);assert.equal(health.body.toString(),'ok');checks.push('health');
 const version=await get(base+'/version.json',2048);assert.equal(version.status,200);assert.deepEqual(JSON.parse(version.body),{ok:true,service:'widget',commit,buildTime:buildDate});checks.push('version');
 const assets=[];
 for(const name of ['widget.js','loader.js']){const r=await get(base+'/'+name);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/(java|ecma)script/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.body.length>100);new vm.Script(r.body.toString(),{filename:name});assets.push({name,bytes:r.body.length,sha256:crypto.createHash('sha256').update(r.body).digest('hex')});checks.push(name);}
 const route='/widget/__ssb_e1_no_provider__',via=await get(base+route,4096),direct=await get(api+route,4096);
 assert.equal(via.status,404);assert.equal(direct.status,404);assert.deepEqual(JSON.parse(via.body),JSON.parse(direct.body));checks.push('proxy');
 const configRoute='/widget/config?siteKey=synthetic-key',configHeaders={origin:'https://synthetic.invalid'};
 const publicVia=await get(base+configRoute,65536,configHeaders),publicDirect=await get(api+configRoute,65536,configHeaders);
 for(const response of [publicVia,publicDirect]){assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/i);publicConfig(JSON.parse(response.body));}
 assert.deepEqual(JSON.parse(publicVia.body),JSON.parse(publicDirect.body));checks.push('public-config');
 assert.equal((await get(base+'/__ssb_e1_missing__',4096)).status,404);checks.push('missing-route');
 return {type:'SSB_WIDGET_VERIFIED',health:200,commit,buildDate,assets,proxy:404,config:200,providerCalls:0,checks};
}
module.exports={verifyWidget,publicConfig};
// The controller appends the explicit, awaited stdin entry; import has no effects.
