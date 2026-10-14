'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const s=require('./snapshot-diagnostic.cjs'),d=require('./diagnostics.cjs'),{sha}=require('./common.cjs');
const binding=stage=>({version:1,action:'database',run:'34567891',source:'94a25578e883a6d7bbd03f26c56735739f75e45e',publication:sha(fs.readFileSync(path.join(__dirname,'publication-manifest.json'))),call:(stage==='before'?'a':'b').repeat(64),restoreStage:stage});
const raw=()=>Object.fromEntries(s.names.map(name=>[name,Array.from({length:{migrations:34,roles:4,markers:2,receipts:7}[name]||1},()=>({synthetic:name,order:1}))]));
const baseline=()=>s.bind(s.measure(raw(),binding('before')),sha(Buffer.from([80,71,68,77,80,0,255])));
const compare=()=>s.compare(baseline(),s.measure(raw(),binding('after')));
test('exact six components, full hash and byte representation retained without normalization',()=>{
 const input=raw(),v=s.measure(input,binding('before'));assert.equal(v.hash,sha(JSON.stringify(input)));assert.deepEqual(v.components.map(x=>x.name),s.names);
 for(const [i,name]of s.names.entries()){assert.equal(v.components[i].hash,sha(JSON.stringify(input[name])));assert.equal(v.components[i].rows,input[name].length);}
 const c=compare();assert.ok(c.components.every(x=>x.equal));assert.equal(c.beforeHash,c.afterHash);
 const changed=raw();changed.tables=[{order:1,synthetic:'tables'}];const r=s.compare(baseline(),s.measure(changed,binding('after')));assert.notEqual(r.beforeHash,r.afterHash);assert.equal(r.components[2].equal,false);
});
for(const name of s.names)test('single component change is isolated: '+name,()=>{
 const changed=raw();changed[name][0].order=2;const c=s.compare(baseline(),s.measure(changed,binding('after')));
 assert.deepEqual(c.components.filter(x=>!x.equal).map(x=>x.name),[name]);assert.notEqual(c.beforeHash,c.afterHash);
 assert.doesNotMatch(JSON.stringify(c),/synthetic|order/);
});
for(const [name,mutate]of Object.entries({run:v=>v.before.binding.run='999',source:v=>v.before.binding.source='f'.repeat(40),publication:v=>v.before.binding.publication='f'.repeat(64),call:v=>v.before.binding.call=binding('after').call,stage:v=>v.before.binding.restoreStage='after',archive:v=>v.archive='not-a-hash',missing:v=>delete v.before,extra:v=>v.private='/private/raw',count:v=>v.before.components.pop(),order:v=>v.before.components.reverse()}))test('baseline rejects '+name,()=>{const v=baseline();mutate(v);assert.throws(()=>s.baseline(v,binding('after'),baseline().before.hash));});
for(const [name,mutate]of Object.entries({run:v=>v.binding.run='999',publication:v=>v.binding.publication='f'.repeat(64),source:v=>v.binding.source='f'.repeat(40),beforeCall:v=>v.binding.beforeCall='c'.repeat(64),afterCall:v=>v.binding.afterCall='c'.repeat(64),archive:v=>v.binding.archive='c'.repeat(64),hash:v=>v.beforeHash='c'.repeat(64),componentHash:v=>{v.components[0].beforeHash='c'.repeat(64);v.components[0].equal=false;},rows:v=>{v.components[0].beforeRows=2;v.components[0].equal=false;},extra:v=>v.raw='private',name:v=>v.components[0].name='private',negative:v=>v.components[0].beforeRows=-1,huge:v=>v.components[0].beforeRows=100001,string:v=>v.components[0].afterRows='1',boolean:v=>v.components[0].equal='true',equality:v=>v.components[0].equal=false,missing:v=>v.components.pop(),duplicate:v=>v.components[1]=v.components[0],extraComponent:v=>v.components[0].raw='private',null:v=>v.binding=null}))test('comparison rejects '+name,()=>{const v=compare();mutate(v);assert.throws(()=>s.comparison(v,binding('after'),baseline()));});
test('success proof requires the same complete comparison and whole-hash equality',()=>{
 const snapshot=s.measure(raw(),binding('after')),snapshotComparison=s.compare(baseline(),snapshot),r={snapshot,snapshotComparison,hashes:[snapshot.hash],counts:[34,4,7]};s.result(r,binding('after'),baseline());
 for(const mutate of [v=>delete v.counts,v=>delete v.snapshot,v=>delete v.snapshotComparison,v=>v.hashes[0]='f'.repeat(64),v=>v.snapshotComparison.components[0].afterHash='f'.repeat(64)]){const v=structuredClone(r);mutate(v);assert.throws(()=>s.result(v,binding('after'),baseline()));}
});
test('bounded canonical failure fits existing 4096-byte process decoder with two cleanup errors',()=>{
 const trace=new d.ProbeProgress(binding('after'));trace.enter('snapshot-compare');trace.lastConfirmed='snapshot-pools';trace.capture(new assert.AssertionError({actual:'a',expected:'b'}));
 const changed=raw();changed.markers.push({synthetic:'new'});trace.snapshot=s.compare(baseline(),s.measure(changed,binding('after')));
 for(let i=0;i<2;i++){trace.enter('pool-close');trace.capture(Object.assign(new Error('PRIVATE'),{code:'EIO'}));}
 const record=trace.diagnostic(),bytes=Buffer.from(d.probeMarker+JSON.stringify(record)+'\n');assert.ok(bytes.length<=4096);assert.deepEqual(d.decodeProbe(bytes,binding('after')),record);assert.doesNotMatch(bytes.toString(),/PRIVATE/);
 for(const mutate of [v=>delete v.snapshot,v=>v.snapshot.components.pop(),v=>v.snapshotError='private',v=>v.snapshot.binding.afterCall='c'.repeat(64)]){const v=structuredClone(record);mutate(v);assert.throws(()=>d.decodeProbe(Buffer.from(d.probeMarker+JSON.stringify(v)+'\n'),binding('after')));}
});
