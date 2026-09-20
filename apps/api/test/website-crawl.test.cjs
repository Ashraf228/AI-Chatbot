const test=require('node:test');const assert=require('node:assert/strict');
const {crawlWebsite,parseRobots,robotsAllows}=require('../dist/ingest/website-crawl');
const {fetchWebsiteSource,WebsiteFetchError}=require('../dist/ingest/website-ingest');
const {PassThrough}=require('node:stream');
const origin='https://example.com';
function page(url,overrides={}){return{finalUrl:url,extractedText:'Inhalt '+url,links:[],pageTitle:url,contentType:'text/html',truncated:false,...overrides};}
function fixture(entries={}){const calls=[];return{calls,async fetchPage(url,options){calls.push({url,options});options.signal.throwIfAborted(); if(options.allowUrl&&!options.allowUrl(url))throw Error('blocked');
 if(url in entries){const v=entries[url];if(v instanceof Error)throw v;return page(url,v);}
 if(url.endsWith('/robots.txt')||url.endsWith('/sitemap.xml'))throw new WebsiteFetchError('not found','http_error',404);
 return page(url);
}};}

test('crawler follows same-origin links and sitemap, obeys robots and deduplicates URLs',async()=>{
 const f=fixture({[origin+'/robots.txt']:{contentType:'text/plain',resourceText:'User-agent: *\nDisallow: /private\nSitemap: https://example.com/sitemap.xml'},
 [origin+'/sitemap.xml']:{resourceText:'<urlset><url><loc>https://example.com/manual</loc></url></urlset>'},
 [origin+'/']:{links:['/help','/private/a','https://foreign.example/','/help#anchor','/search?q=x','/file.pdf']}});
 const result=await crawlWebsite(origin+'/',f);
 assert.deepEqual(result.pages.map(p=>p.finalUrl),[origin+'/',origin+'/manual',origin+'/help']);assert.equal(result.complete,true);
 assert.equal(f.calls.some(c=>c.url.includes('/private')),false);assert.equal(f.calls.some(c=>c.url.includes('foreign')),false);
 assert.equal(result.excluded[0].reason,'robots');
});
test('robots most specific group and longest allow path override wildcard rules',()=>{
 const rules=parseRobots('User-agent: *\nDisallow: /\nUser-agent: SouleKnowledgeIngest\nDisallow: /private\nAllow: /private/public\nDisallow: /*?secret=*').rules;
 assert.equal(robotsAllows(origin+'/help',rules),true);assert.equal(robotsAllows(origin+'/private/x',rules),false);
 assert.equal(robotsAllows(origin+'/private/public/a',rules),true);assert.equal(robotsAllows(origin+'/help?secret=x',rules),false);
});
test('blocked root and inaccessible robots fail before page transport',async()=>{
 for(const robot of [{contentType:'text/plain',resourceText:'User-agent: *\nDisallow: /'},new WebsiteFetchError('error','http_error',503)]){
 const f=fixture({[origin+'/robots.txt']:robot});await assert.rejects(crawlWebsite(origin+'/',f));assert.equal(f.calls.length,1);}
});
test('crawl caps and duplicate content are explicit',async()=>{
 const f=fixture({[origin+'/']:{links:['/a','/b']},[origin+'/a']:{extractedText:'Inhalt '+origin+'/'}});
 const result=await crawlWebsite(origin+'/',{...f,maxPages:2});assert.equal(result.complete,false);assert.equal(result.pages.length,1);
 assert.ok(result.excluded.some(x=>x.reason==='duplicate'));assert.ok(result.excluded.some(x=>x.reason==='page_limit'));
});
test('sitemap DTD is refused and cross-origin sitemap is never fetched',async()=>{
 const f=fixture({[origin+'/robots.txt']:{contentType:'text/plain',resourceText:'Sitemap: https://foreign.example/map.xml'},[origin+'/sitemap.xml']:{resourceText:'<!DOCTYPE a><urlset/>'}});
 await assert.rejects(crawlWebsite(origin+'/',f),{code:'sitemap_blocked'});assert.equal(f.calls.some(x=>x.url.includes('foreign')),false);
});
test('aborted crawl starts no request',async()=>{
 const c=new AbortController();c.abort();let calls=0;
 await assert.rejects(crawlWebsite(origin+'/',{signal:c.signal,fetchPage:async()=>{calls++;c.signal.throwIfAborted();}}),{name:'AbortError'});
 assert.equal(calls,0);
});
test('redirect target is checked before transport, including query paths',async()=>{
 let count=0;
 await assert.rejects(fetchWebsiteSource(origin+'/',{allowedOrigin:origin,allowUrl:u=>!new URL(u).search,
 resolver:async()=>[{address:'93.184.216.34',family:4}],requestImpl:async()=>{count++;const r=new PassThrough();r.statusCode=302;r.headers={location:origin+'/?secret=x'};process.nextTick(()=>r.end());return r;}}));
 assert.equal(count,1);
});
test('HTML extraction exposes child links and page title without script text',async()=>{
 const result=await fetchWebsiteSource(origin+'/',{resolver:async()=>[{address:'93.184.216.34',family:4}],requestImpl:async()=>{
 const r=new PassThrough();r.statusCode=200;r.headers={'content-type':'text/html'};process.nextTick(()=>r.end('<html><title>Hilfe</title><script>IGNORE</script><p>Ausführliche Hilfe zur täglichen Datensicherung.</p><a href="/backup">Backup</a></html>'));return r;}});
 assert.equal(result.pageTitle,'Hilfe');assert.ok(result.links.includes('/backup'));assert.equal(result.extractedText.includes('IGNORE'),false);
});

for(const address of ['127.0.0.2','100.64.0.1','198.18.0.1','224.0.0.1','fe90::1','ff02::1'])test(`crawler DNS rejects nonpublic ${address} before any HTTP`,async()=>{
 let calls=0;await assert.rejects(fetchWebsiteSource(origin+'/',{resolver:async()=>[{address,family:address.includes(':')?6:4}],requestImpl:async()=>{calls++;throw Error('must not request');}}));assert.equal(calls,0);
});

test('sitemap and extracted-link limits never claim a complete crawl',async()=>{
 const f=fixture({[origin+'/robots.txt']:{contentType:'text/plain',resourceText:'Sitemap: /a.xml\nSitemap: /b.xml\nSitemap: /c.xml\nSitemap: /d.xml'},
 [origin+'/a.xml']:{resourceText:'<urlset/>'},[origin+'/b.xml']:{resourceText:'<urlset/>'},[origin+'/c.xml']:{resourceText:'<urlset/>'}});
 assert.equal((await crawlWebsite(origin+'/',f)).complete,false);
 const links=fixture({[origin+'/']:{linksTruncated:true}});assert.equal((await crawlWebsite(origin+'/',links)).complete,false);
});

// Run hostile patterns in a separate process so a regression cannot hang the test runner.
test('review regression: wildcard rules cannot stall the event loop', () => {
 const {spawnSync}=require('node:child_process');
 const program=`const assert=require('node:assert/strict');
 const {robotsAllows}=require(${JSON.stringify(require.resolve('../dist/ingest/website-crawl'))});
 const rule={allow:false,path:'/'+ 'a*'.repeat(32)+'z$'};
 assert.equal(robotsAllows('https://example.com/'+ 'a'.repeat(90),[rule]),true);`;
 const result=spawnSync(process.execPath,['-e',program],{timeout:2000,encoding:'utf8'});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
});

test('review regression: percent-encoded unreserved paths obey robots', () => {
 const rules=parseRobots('User-agent: *\nDisallow: /private').rules;
 for(const path of ['/private','/%70rivate','/pr%69vate','/%70%72%69%76%61%74%65']) {
  assert.equal(robotsAllows(origin+path,rules),false,path);
 }
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
async function outcomeWithin(promise,ms=100){
 let timer;
 try{return await Promise.race([promise.then(value=>({status:'fulfilled',value}),error=>({status:'rejected',error})),
  new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'pending'}),ms);})]);}
 finally{clearTimeout(timer);}
}
const publicAddresses=[{address:'93.184.216.34',family:4}];

for(const mode of ['abort','timeout'])test(`review regression: pending DNS is bounded by ${mode}`,async()=>{
 const pending=deferred(),started=deferred(),controller=new AbortController();let requests=0;
 const reason=new Error('cancel synthetic crawl');
 const attempt=fetchWebsiteSource(origin+'/',{
  resolver:()=>{started.resolve();return pending.promise;},signal:controller.signal,timeoutMs:mode==='timeout'?20:1000,
  requestImpl:async()=>{requests++;throw Error('late transport');}
 });
 // Observe rejection immediately, including failures before the deferred resolver is released.
 const observed=outcomeWithin(attempt);
 try {
  await started.promise;if(mode==='abort')controller.abort(reason);
  const result=await observed;
  assert.equal(result.status,'rejected','DNS must settle before its pending resolver returns');
  if(mode==='abort')assert.equal(result.error,reason);
  else assert.equal(result.error.code,'fetch_timeout');
 } finally {
  pending.resolve(publicAddresses);await attempt.catch(()=>{});
 }
 assert.equal(requests,0,'late DNS success must not start HTTP');
});

test('robots normalization preserves UTF-8, reserved escapes and literal wildcard markers',()=>{
 const denied=(path,rule)=>assert.equal(robotsAllows(origin+path,[{allow:false,path:rule}]),false,`${path} against ${rule}`);
 denied('/caf%C3%A9','/café');denied('/café','/caf%c3%a9');
 denied('/file*.html','/file%2a.html$');denied('/file%2A.html','/file%2A.html$');
 denied('/cost$','/cost%24$');denied('/private%2fsecret','/private%2Fsecret');
 assert.equal(robotsAllows(origin+'/private%2Fsecret',[{allow:false,path:'/private/secret'}]),true);
 assert.equal(robotsAllows(origin+'/%2570rivate',[{allow:false,path:'/private'}]),true,'never double-decode');
 assert.equal(robotsAllows(origin+'/fileABC.html',[{allow:false,path:'/file%2A.html$'}]),true);
 assert.equal(robotsAllows(origin+'/PRIVATE',[{allow:false,path:'/private'}]),true,'paths remain case-sensitive');
 const rules=[{allow:false,path:'/%70rivate'},{allow:true,path:'/private'}];
 assert.equal(robotsAllows(origin+'/private',rules),true,'equivalent allow wins after normalization');
 rules.push({allow:false,path:'/private/secret'});
 assert.equal(robotsAllows(origin+'/pr%69vate/secret',rules),false,'encoding does not inflate specificity');
 assert.throws(()=>robotsAllows(origin+'/%zz',rules),{code:'robots_encoding_invalid'});
});

test('bounded wildcard matcher preserves prefix, suffix and zero-length wildcard semantics',()=>{
 const strings=(alphabet,n)=>{let all=[''],level=[''];for(let i=0;i<n;i++){level=level.flatMap(s=>alphabet.map(c=>s+c));all.push(...level);}return all;};
 const targets=strings(['a','b'],4),patterns=strings(['a','b','*'],4);
 for(const value of patterns)for(const exact of [false,true]){
  const pattern='/'+value+(exact?'$':'');
  // Deliberately tiny reference patterns: exhaustive semantic comparison, no hostile regex.
  const reference=new RegExp('^/'+value.split('*').join('.*')+(exact?'$':''));
  for(const path of targets)assert.equal(robotsAllows(origin+'/'+path,[{allow:false,path:pattern}]),!reference.test('/'+path),`${pattern} /${path}`);
 }
});

test('combined robots matching work has a fail-closed upper bound',()=>{
 const target=origin+'/'+ 'a'.repeat(2000);
 const rules=Array.from({length:2000},()=>({allow:false,path:'/*z'}));
 assert.throws(()=>robotsAllows(target,rules),{code:'robots_complexity_exceeded'});
});

test('encoded roots, discovered links and sitemap paths are blocked before page transport',async()=>{
 const robot={contentType:'text/plain',resourceText:'User-agent: *\nDisallow: /private'};
 const root=fixture({[origin+'/robots.txt']:robot});
 await assert.rejects(crawlWebsite(origin+'/%70rivate',root),{code:'robots_blocked'});assert.equal(root.calls.length,1);
 const links=fixture({[origin+'/robots.txt']:robot,[origin+'/']:{links:['/%70rivate','/pr%69vate/a']},
  [origin+'/sitemap.xml']:{resourceText:'<urlset><url><loc>https://example.com/%70rivate/map</loc></url></urlset>'}});
 const result=await crawlWebsite(origin+'/',links);
 assert.deepEqual(result.pages.map(p=>p.finalUrl),[origin+'/']);
 assert.equal(result.excluded.filter(x=>x.reason==='robots').length,3);
 assert.equal(links.calls.some(x=>x.url.includes('%')),false);
});

test('encoded redirect is rejected by robots before its HTTP request',async()=>{
 let requests=0;
 await assert.rejects(fetchWebsiteSource(origin+'/',{
  resolver:async()=>publicAddresses,allowUrl:url=>robotsAllows(url,[{allow:false,path:'/private'}]),
  requestImpl:async()=>{requests++;const r=new PassThrough();r.statusCode=302;r.headers={location:'/%70rivate'};process.nextTick(()=>r.end());return r;}
 }),{code:'crawl_scope_blocked'});
 assert.equal(requests,1);
});

test('redirect DNS observes abort and suppresses late resolver rejection',async()=>{
 const pending=deferred(),started=deferred(),controller=new AbortController();let lookups=0,requests=0;
 const reason=new Error('cancel redirect DNS');
 const attempt=fetchWebsiteSource(origin+'/',{
  resolver:async()=>{if(++lookups===1)return publicAddresses;started.resolve();return pending.promise;},signal:controller.signal,
  requestImpl:async()=>{requests++;const r=new PassThrough();r.statusCode=302;r.headers={location:'/next'};process.nextTick(()=>r.end());return r;}
 });
 const observed=outcomeWithin(attempt);
 try{await started.promise;controller.abort(reason);const result=await observed;assert.equal(result.status,'rejected');assert.equal(result.error,reason);}
 finally{pending.reject(Error('late DNS failure'));await attempt.catch(()=>{});await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(requests,1);
});

test('DNS and redirects share the complete fetch deadline',async()=>{
 let lookups=0,requests=0;
 await assert.rejects(fetchWebsiteSource(origin+'/',{
  timeoutMs:40,resolver:async()=>{lookups++;await new Promise(resolve=>setTimeout(resolve,25));return publicAddresses;},
  requestImpl:async()=>{requests++;const r=new PassThrough();r.statusCode=302;r.headers={location:'/next'};process.nextTick(()=>r.end());return r;}
 }),{code:'fetch_timeout'});
 await new Promise(resolve=>setTimeout(resolve,35));
 assert.equal(lookups,2);assert.equal(requests,1);
});

for(const mode of ['abort','timeout'])test(`native DNS Resolver really cancels both outstanding queries on ${mode}`,async(t)=>{
 const dns=require('node:dns/promises'),dgram=require('node:dgram');
 const {once,getEventListeners}=require('node:events');
 const NativeResolver=dns.Resolver,server=dgram.createSocket('udp4');
 const received=new Set(),started=deferred(),failures=[];let cancels=0,requests=0;
 server.on('message',packet=>{received.add(packet.readUInt16BE(packet.length-4));if(received.size===2)started.resolve();});
 server.bind(0,'127.0.0.1');await once(server,'listening');
 t.mock.method(dns,'Resolver',class extends NativeResolver{
  constructor(options){
   super(options);this.setServers([`127.0.0.1:${server.address().port}`]);
   const resolve4=this.resolve4.bind(this),resolve6=this.resolve6.bind(this),cancel=this.cancel.bind(this);
   this.resolve4=host=>resolve4(host).catch(error=>{failures.push(error.code);throw error;});
   this.resolve6=host=>resolve6(host).catch(error=>{failures.push(error.code);throw error;});
   this.cancel=()=>{cancels++;return cancel();};
  }
 });
 const controller=new AbortController(),reason=new Error('synthetic DNS abort');
 try{
  const attempt=fetchWebsiteSource(origin+'/',{timeoutMs:mode==='timeout'?60:1000,signal:controller.signal,
   requestImpl:async()=>{requests++;throw Error('unexpected HTTP');}});
  const observed=outcomeWithin(attempt,1500);
  if(mode==='abort'){const queryStart=await outcomeWithin(started.promise,500);assert.equal(queryStart.status,'fulfilled');controller.abort(reason);}
  const result=await observed;assert.equal(result.status,'rejected');
  if(mode==='abort')assert.equal(result.error,reason);else assert.equal(result.error.code,'fetch_timeout');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual([...received].sort((a,b)=>a-b),[1,28],'actual A and AAAA questions reached loopback DNS');
  assert.deepEqual(failures,['ECANCELLED','ECANCELLED']);assert.equal(cancels,1);assert.equal(requests,0);
  assert.equal(getEventListeners(controller.signal,'abort').length,0);
 }finally{controller.abort(reason);t.mock.restoreAll();await new Promise(resolve=>server.close(resolve));}
});

test('aborting one lookup cannot cancel another crawl resolver',async(t)=>{
 const dns=require('node:dns/promises'),NativeResolver=dns.Resolver,instances=[];
 t.mock.method(dns,'Resolver',class extends NativeResolver{
  constructor(options){
   super(options);this.queries=[];this.cancels=0;instances.push(this);const cancel=this.cancel.bind(this);
   this.resolve4=this.resolve6=()=>{const d=deferred();this.queries.push(d);return d.promise;};
   this.cancel=()=>{this.cancels++;for(const d of this.queries)d.reject(Object.assign(Error('cancelled'),{code:'ECANCELLED'}));return cancel();};
  }
 });
 const {validatePublicWebsiteUrl}=require('../dist/ingest/website-ingest');
 const controller=new AbortController();
 const first=validatePublicWebsiteUrl(origin,undefined,{signal:controller.signal});const firstResult=outcomeWithin(first);
 const second=validatePublicWebsiteUrl(origin);
 try{
  controller.abort();assert.equal((await firstResult).status,'rejected');assert.equal(instances[0].cancels,1);assert.equal(instances[1].cancels,0);
  instances[1].queries[0].resolve(['93.184.216.34']);instances[1].queries[1].resolve([]);
  assert.equal((await second).pinnedAddress.address,'93.184.216.34');
 }finally{for(const instance of instances)instance.cancel();await Promise.allSettled([first,second]);}
});

for(const ipv6 of ['public','private','absent'])test(`native DNS answers retain SSRF checks with ${ipv6} IPv6`,async(t)=>{
 const dns=require('node:dns/promises'),dgram=require('node:dgram'),{once}=require('node:events');
 const {validatePublicWebsiteUrl}=require('../dist/ingest/website-ingest');
 const NativeResolver=dns.Resolver,server=dgram.createSocket('udp4');
 server.on('message',(question,peer)=>{
  const type=question.readUInt16BE(question.length-4);
  const address=type===1?Buffer.from([93,184,216,34]):ipv6==='absent'?null:
   Buffer.from(ipv6==='private'?'fd000000000000000000000000000001':'26064700000000000000000000001111','hex');
  const header=Buffer.from(question);header.writeUInt16BE(0x8180,2);header.writeUInt16BE(address?1:0,6);
  let answer=Buffer.alloc(0);
  if(address){answer=Buffer.alloc(12+address.length);answer.writeUInt16BE(0xc00c,0);answer.writeUInt16BE(type,2);
   answer.writeUInt16BE(1,4);answer.writeUInt32BE(30,6);answer.writeUInt16BE(address.length,10);address.copy(answer,12);}
  server.send(Buffer.concat([header,answer]),peer.port,peer.address);
 });
 server.bind(0,'127.0.0.1');await once(server,'listening');
 t.mock.method(dns,'Resolver',class extends NativeResolver{
  constructor(options){super(options);this.setServers([`127.0.0.1:${server.address().port}`]);}
 });
 try{
  const result=validatePublicWebsiteUrl(origin,undefined,{timeoutMs:1000});
  if(ipv6==='private')await assert.rejects(result,{code:'resolved_ip_blocked'});
  else assert.deepEqual((await result).pinnedAddress,publicAddresses[0]);
 }finally{t.mock.restoreAll();await new Promise(resolve=>server.close(resolve));}
});

test('standalone URL validation also bounds DNS and observes pre-abort',async()=>{
 const {validatePublicWebsiteUrl}=require('../dist/ingest/website-ingest');
 const pending=deferred();let lookups=0;
 const attempt=validatePublicWebsiteUrl(origin,()=>{lookups++;return pending.promise;},{timeoutMs:20});
 try{const result=await outcomeWithin(attempt);assert.equal(result.status,'rejected');assert.equal(result.error.code,'fetch_timeout');}
 finally{pending.reject(Error('late failure'));await attempt.catch(()=>{});}
 const controller=new AbortController();controller.abort();
 await assert.rejects(validatePublicWebsiteUrl(origin,()=>{lookups++;return Promise.resolve(publicAddresses);},{signal:controller.signal}),{name:'AbortError'});
 assert.equal(lookups,1);
});
