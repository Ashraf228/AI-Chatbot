'use strict';
const {isIP}=require('node:net');
const {need,clock}=require('./common.cjs');
const own=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&JSON.stringify(Object.keys(v).sort())===JSON.stringify([...k].sort());
const utc=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
const errors=['unknown','EACCES','EPERM','ENOENT','EIO','ESRCH','ENOTFOUND','EAI_AGAIN','deadline','invalid','identity','command_failed','command_timeout','output_limit','spawn_failed','process_completion_unverified','evidence_write_failed','probe_work_deadline','disk_floor','memory_floor','resource_floor_observed'];
const code=e=>errors.includes(e?.code)?e.code:'unknown';
// Only synthetic, private/loopback addresses are exportable; never arbitrary names.
function address(v){
 if(typeof v!=='string'||v.length>64||v.includes('%'))return null;
 if(isIP(v)===4){const p=v.split('.').map(Number);return p[0]===10||p[0]===127||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31||v==='0.0.0.0'?v:null;}
 if(isIP(v)===6){const c=new URL('http://['+v+']/').hostname.slice(1,-1);return c==='::'||c==='::1'||/^f[cd][0-9a-f]{2}:/.test(c)||/^fe[89ab][0-9a-f]:/.test(c)?c:null;}
 return null;
}
function validateSample(s,mode,b,id){
 need(own(s,['call','container','mode','observedAt','ok','code','data'])&&s.call===b.call&&s.container===id&&s.mode===mode&&utc(s.observedAt)&&typeof s.ok==='boolean'&&errors.includes(s.code),'dashboard_diagnostic_invalid');
 if(!s.ok){need(s.data===null,'dashboard_diagnostic_invalid');return s;}
 need(s.code==='unknown','dashboard_diagnostic_invalid');
 const d=s.data;
 if(mode==='process'){
  need(own(d,['process','hostname','port','listeners','startStatus'])&&['expected','next-server','next-title-truncated','other'].includes(d.process),'dashboard_diagnostic_invalid');
  need(own(d.hostname,['kind','value'])&&['unset','address','localhost','container-id','unrecognized'].includes(d.hostname.kind),'dashboard_diagnostic_invalid');
  need(d.hostname.kind==='address'?address(d.hostname.value)===d.hostname.value:d.hostname.kind==='localhost'?d.hostname.value==='localhost':d.hostname.kind==='container-id'?[id,id.slice(0,12)].includes(d.hostname.value):d.hostname.value===null,'dashboard_diagnostic_invalid');
  need(own(d.port,['source','value'])&&['default','environment','invalid'].includes(d.port.source)&&(d.port.source==='invalid'?d.port.value===null:Number.isInteger(d.port.value)&&d.port.value>0&&d.port.value<=65535)&&(d.port.source!=='default'||d.port.value===3000),'dashboard_diagnostic_invalid');
  need(Array.isArray(d.listeners)&&d.listeners.length<=16&&d.listeners.every(x=>own(x,['address','port'])&&address(x.address)===x.address&&x.address!==null&&Number.isInteger(x.port)&&x.port>0&&x.port<=65535),'dashboard_diagnostic_invalid');
  need(new Set(d.listeners.map(x=>x.address+':'+x.port)).size===d.listeners.length,'dashboard_diagnostic_invalid');
  const expected=d.process==='other'?'process-unverified':d.listeners.some(x=>x.port===d.port.value)?'listener-on-configured-port':d.listeners.length?'listener-on-other-port':'no-pid1-listener';
  need(d.startStatus===expected,'dashboard_diagnostic_invalid');
 }else need(own(d,['addresses'])&&Array.isArray(d.addresses)&&d.addresses.length>0&&d.addresses.length<=16&&new Set(d.addresses).size===d.addresses.length&&d.addresses.every(v=>address(v)===v&&v!==null),'dashboard_diagnostic_invalid');
 return s;
}
function validate(v,b){
 need(own(v,['version','binding','container','image','observedAt','networks','process','dns','errors'])&&v.version===1&&v.binding?.operation==='closed-ready'&&v.binding.service==='probe'&&/^[a-f0-9]{64}$/.test(v.container)&&/^sha256:[a-f0-9]{64}$/.test(v.image)&&utc(v.observedAt),'dashboard_diagnostic_invalid');
 require('./diagnostics.cjs').startProtocol().binding(v.binding);
 if(b)need(JSON.stringify(v.binding)===JSON.stringify(b),'dashboard_diagnostic_misbound');
 need(Array.isArray(v.errors)&&v.errors.length<=3&&new Set(v.errors.map(e=>e.step)).size===v.errors.length&&v.errors.every(e=>own(e,['step','code'])&&['inspect','process','dns'].includes(e.step)&&errors.includes(e.code)),'dashboard_diagnostic_invalid');
 need(Array.isArray(v.networks)&&v.networks.length<=3,'dashboard_diagnostic_invalid');
 if(v.errors.some(e=>e.step==='inspect'))need(v.networks.length===0&&v.process===null&&v.dns===null,'dashboard_diagnostic_invalid');
 else{
  need(JSON.stringify(v.networks.map(x=>x.key).sort())===JSON.stringify(['admin_writer','ingress','internal']),'dashboard_diagnostic_invalid');
  for(const n of v.networks)need(own(n,['key','id','addresses'])&&/^[a-f0-9]{64}$/.test(n.id)&&Array.isArray(n.addresses)&&n.addresses.length>0&&n.addresses.length<=2&&new Set(n.addresses).size===n.addresses.length&&n.addresses.every(ip=>address(ip)===ip&&ip!==null),'dashboard_diagnostic_invalid');
  need(new Set(v.networks.map(n=>n.id)).size===3,'dashboard_diagnostic_invalid');
  for(const mode of ['process','dns']){const sample=v[mode];if(sample===null)need(v.errors.some(e=>e.step===mode),'dashboard_diagnostic_invalid');else{validateSample(sample,mode,v.binding,v.container);need(!v.errors.some(e=>e.step===mode),'dashboard_diagnostic_invalid');}}
 }
 return v;
}
// Executed as fixed stdin-fed code inside the existing containers, never via a shell.
// It reads only PID 1 metadata/socket ownership, or resolves the fixed internal alias.
async function worker(){
 const fs=require('node:fs'),net=require('node:net');
 const request=JSON.parse(fs.readFileSync(0,'utf8'));
 const {call,container,mode}=request;
 if(!/^[a-f0-9]{64}$/.test(call)||!/^[a-f0-9]{64}$/.test(container)||!['process','dns'].includes(mode)||Object.keys(request).sort().join(',')!=='call,container,mode')throw Error('invalid');
 const safe=v=>{
  if(typeof v!=='string'||v.length>64||v.includes('%'))return null;
  if(net.isIP(v)===4){const p=v.split('.').map(Number);return p[0]===10||p[0]===127||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31||v==='0.0.0.0'?v:null;}
  if(net.isIP(v)===6){const c=new URL('http://['+v+']/').hostname.slice(1,-1);return c==='::'||c==='::1'||/^f[cd][0-9a-f]{2}:/.test(c)||/^fe[89ab][0-9a-f]:/.test(c)?c:null;}return null;
 };
 const invalid=()=>{throw Object.assign(Error('invalid'),{code:'invalid'});};
 const read=p=>{const b=fs.readFileSync(p);if(b.length>262144)invalid();return b.toString();};
 const result={call,container,mode,observedAt:new Date().toISOString(),ok:false,code:'unknown',data:null};
 try{
  if(mode==='dns'){
   const rows=await require('node:dns').promises.lookup('dashboard',{all:true});
   if(!rows.length||rows.length>16||rows.some(x=>!safe(x.address)))invalid();
   result.data={addresses:[...new Set(rows.map(x=>safe(x.address)))].sort()};
  }else{
   const argv=read('/proc/1/cmdline').split('\0').filter(Boolean);
   // Node's bound short argv can truncate the title; that category does not confirm a version.
   const process=argv.length===2&&['node','/usr/local/bin/node','/usr/bin/node'].includes(argv[0])&&['app/server.js','/app/app/server.js'].includes(argv[1])?'expected':argv.length===1&&argv[0]==='next-server (v16.3.8)'?'next-server':argv.length===1&&argv[0]==='next-server (v16.3'?'next-title-truncated':'other';
   const env=read('/proc/1/environ').split('\0'),selected={};
   for(const field of env){const pos=field.indexOf('='),key=field.slice(0,pos);if(['HOSTNAME','PORT'].includes(key)){if(Object.hasOwn(selected,key))invalid();selected[key]=field.slice(pos+1);}}
   const host=selected.HOSTNAME;
   const hostname=!host?{kind:'unset',value:null}:safe(host)?{kind:'address',value:safe(host)}:host==='localhost'?{kind:'localhost',value:host}:[container,container.slice(0,12)].includes(host)?{kind:'container-id',value:host}:{kind:'unrecognized',value:null};
   const rawPort=selected.PORT,n=Number.parseInt(rawPort,10)||3000;
   const port=rawPort===undefined||rawPort===''?{source:'default',value:3000}:/^\d{1,5}$/.test(rawPort)&&n>0&&n<=65535?{source:'environment',value:n}:{source:'invalid',value:null};
   const fds=fs.readdirSync('/proc/1/fd');if(fds.length>256)invalid();
   const sockets=new Set();
   for(const fd of fds){if(!/^\d+$/.test(fd))invalid();let link;try{link=fs.readlinkSync('/proc/1/fd/'+fd);}catch(e){if(e.code==='ENOENT')continue;throw e;}const m=/^socket:\[(\d+)\]$/.exec(link);if(m)sockets.add(m[1]);}
   const listeners=[];
   for(const family of ['tcp','tcp6']){
    const lines=read('/proc/1/net/'+family).trim().split('\n');if(!lines[0]?.includes('local_address'))invalid();
    for(const line of lines.slice(1)){const p=line.trim().split(/\s+/);if(p.length<10)invalid();if(p[3]!=='0A'||!sockets.has(p[9]))continue;
     const pair=/^([A-Fa-f0-9]+):([A-Fa-f0-9]{4})$/.exec(p[1]);if(!pair||pair[1].length!==(family==='tcp'?8:32))invalid();
     const bytes=Buffer.from(pair[1],'hex');for(let i=0;i<bytes.length;i+=4)bytes.subarray(i,i+4).reverse();
     const ip=family==='tcp'?[...bytes].join('.'):Array.from({length:8},(_,i)=>bytes.readUInt16BE(i*2).toString(16)).join(':');
     const addr=safe(ip),port=parseInt(pair[2],16);if(!addr||port===0)invalid();listeners.push({address:addr,port});if(listeners.length>16)invalid();
    }
   }
   const unique=[...new Map(listeners.map(x=>[x.address+':'+x.port,x])).values()].sort((a,b)=>a.address.localeCompare(b.address)||a.port-b.port);
   result.data={process,hostname,port,listeners:unique,startStatus:process==='other'?'process-unverified':unique.some(x=>x.port===port.value)?'listener-on-configured-port':unique.length?'listener-on-other-port':'no-pid1-listener'};
  }
  result.ok=true;
 }catch(e){result.code=['EACCES','EPERM','ENOENT','EIO','ESRCH','ENOTFOUND','EAI_AGAIN','invalid'].includes(e?.code)?e.code:'unknown';result.data=null;}
 return result;
}
const workerSource='('+worker.toString()+')().then(r=>process.stdout.write(JSON.stringify(r))).catch(()=>{process.exitCode=1;});';
function target(error){
 let count=0;
 const visit=(e,inherited,depth)=>{
  if(++count>16||depth>4)return null;
  const b=e?.startOperation||inherited,p=e?.probeDiagnostic;
  if(p?.primary?.step==='closed-dashboard'&&b?.operation==='closed-ready'){
   try{require('./diagnostics.cjs').startProtocol().binding(b);need(['run','source','publication','call','generation'].every(k=>b[k]===p.binding?.[k]),'identity');return{primary:e,binding:b};}catch{return null;}
  }
  for(const c of (Array.isArray(e?.errors)?e.errors.slice(0,4):e?.cause?[e.cause]:[])){const r=visit(c,b,depth+1);if(r)return r;}return null;
 };
 return visit(error,null,0);
}
async function collect(native,error){
 const found=target(error);if(!found)return;
 const {primary,binding:b}=found;primary.startOperation=b;
 const entry=native.owned.find(x=>x.role==='dashboard'&&x.generation===b.generation);
 if(!entry?.id){primary.dashboardError='identity';return;}
 const record={version:1,binding:b,container:entry.id,image:entry.image,observedAt:new Date().toISOString(),networks:[],process:null,dns:null,errors:[]};
 const until=Math.min(clock()+1500,native.deadline-30000,native.probeDeadline-30000);
 const remaining=()=>{const left=Math.floor(until-clock());if(!(left>100))throw Object.assign(Error(),{code:'deadline'});return left;};
 try{
  const x=(await native.inspect(entry.id,{ms:remaining()}))[0];
  need(x?.Id===entry.id&&x.Image===entry.image&&x.Name==='/'+entry.name&&x.Config?.Labels?.['com.ssb.native-run']===native.options.run&&x.State?.Running===true,'identity');
  const keys=['internal','admin_writer','ingress'];
  need(JSON.stringify(Object.keys(x.NetworkSettings?.Networks||{}).sort())===JSON.stringify(keys.map(k=>native.networks[k].name).sort()),'identity');
  const nets=keys.map(key=>{const bound=native.networks[key],n=x.NetworkSettings.Networks[bound.name];need(n.NetworkID===bound.id,'identity');const addresses=[n.IPAddress,n.GlobalIPv6Address].filter(Boolean).map(ip=>{const a=address(ip);need(a!==null,'invalid');return a;});need(addresses.length>0&&addresses.length<=2,'invalid');return{key,id:bound.id,addresses};});
  record.networks=nets;
 }catch(e){record.errors.push({step:'inspect',code:code(e)});primary.dashboardDiagnostic=validate(record,b);return;}
 for(const mode of ['process','dns'])try{
  const container=mode==='process'?entry.id:native.probeContainer.id;
  const r=await native.d(['exec','-i',container,'node','-e',workerSource],{input:JSON.stringify({call:b.call,container:entry.id,mode}),ms:remaining()});
  need(r.stderr.length===0&&r.stdout.length>0&&r.stdout.length<=8192,'invalid');
  const sample=JSON.parse(r.stdout.toString());validateSample(sample,mode,b,entry.id);record[mode]=sample;
 }catch(e){record.errors.push({step:mode,code:code(e)});}
 primary.dashboardDiagnostic=validate(record,b);
}
module.exports={address,validateSample,validate,worker,workerSource,target,collect,code,errors};
