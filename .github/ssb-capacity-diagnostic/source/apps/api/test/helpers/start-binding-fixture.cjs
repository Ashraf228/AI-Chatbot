const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const yaml = require('js-yaml');
const policy = require('../../../../scripts/ops/maintenance-start-contract.cjs');
const verifyRealFiles = policy.verifyFiles;
const sha = b => createHash('sha256').update(b).digest('hex');

// Real file bytes/modes, simulated Linux UID metadata only. No Docker or network call.
function fixture(t, binding, selected = 'api') {
  binding.root=fs.realpathSync(binding.root);
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'start-contract-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const image = n=>'sha256:'+String(n).repeat(64);
  const project=`${binding.service}-${binding.generation}`;
  const values = {
    MAINTENANCE_HOST_STATE: binding.root, MAINTENANCE_SERVICE: binding.service, MAINTENANCE_GENERATION: binding.generation,
    RETAINED_API_NAME:project+'-api',RETAINED_WRITER_NAME:project+'-admin-writer',RETAINED_DASHBOARD_NAME:project+'-dashboard',
    RETAINED_REPORTER_NAME:project+'-reporter',RETAINED_WIDGET_NAME:project+'-widget',
    ADMIN_WRITER_RUNTIME_HOST_FILE: path.join(dir,'runtime'), ADMIN_WRITER_KEY_HOST_FILE:path.join(dir,'key'),
    ADMIN_WRITER_DB_HOST_FILE:path.join(dir,'writer-db'), ADMIN_WRITER_API_IMAGE:image(1), ADMIN_WRITER_DASHBOARD_IMAGE:image(2),
    ADMIN_WRITER_REPORTER_IMAGE:image(3), ADMIN_WRITER_WIDGET_IMAGE:image(4),
    RUNTIME_DATABASE_URL:'postgresql://ssb_runtime:synthetic-only@db:5432/synthetic', REDIS_URL:'redis://redis:6379',
    OPENAI_API_KEY:'synthetic-unused', ADMIN_KEY:'synthetic-unused', ADMIN_SESSION_SECRET:'s'.repeat(64),
    DASHBOARD_INTERNAL_TOKEN:'d'.repeat(64), REPORTER_API_TOKEN:'r'.repeat(64),
    REPORTER_SITE_BINDINGS:'[{"siteId":"synthetic-site","tenantId":"synthetic-tenant"}]',
    OPENAI_EMBED_MODEL:'synthetic', OPENAI_MODEL:'synthetic', ADMIN_PANEL_PASSWORD_HASH:'synthetic-unused',
    DASHBOARD_PUBLIC_URL:'https://synthetic.invalid', SMTP_HOST:'sink',SMTP_PORT:'1025',SMTP_USER:'synthetic',SMTP_PASS:'synthetic',REPORTS_FROM_EMAIL:'test@example.invalid',
    SITE_PILOT_ACCESS_RULES_JSON:JSON.stringify([{tenantId:'synthetic-tenant',siteId:'synthetic-site',tokenSha256:'a'.repeat(64),validFrom:'2026-01-01T00:00:00.000Z',expiresAt:'2026-01-01T00:30:00.000Z'}]),
    INTEGRATION_SECRET_KEY:'a'.repeat(64),INTEGRATION_SECRET_KEY_PREVIOUS:'',INTEGRATION_SECRET_LEGACY_KEYS:'',
    ADMIN_DOMAIN:'synthetic.invalid',API_DOMAIN:'api.synthetic.invalid',WIDGET_DOMAIN:'widget.synthetic.invalid',
    SITE_DOMAIN_ALLOWLIST_MODE:'strict',CORS_ALLOWED_ORIGINS:'https://synthetic.invalid',
    PUBLIC_API_BASE_URL:'https://api.synthetic.invalid',PUBLIC_WIDGET_BUNDLE_URL:'https://widget.synthetic.invalid/widget.js',
    NEXT_PUBLIC_WIDGET_LOADER_URL:'https://widget.synthetic.invalid/loader.js',LEAD_NOTIFICATION_EMAIL:'',ADMIN_EMAIL:'',APP_URL:'',OPERATOR_PANEL_PASSWORD_HASH:'',
    BOUND_INTERNAL_NETWORK:'synthetic-internal',BOUND_WRITER_NETWORK:'synthetic-writer',BOUND_INGRESS_NETWORK:'synthetic-ingress',BOUND_EGRESS_NETWORK:'synthetic-egress',BOUND_WIDGET_API_NETWORK:'synthetic-widget-api',
  };
  const source=fs.readFileSync(path.join(__dirname,'../../../../docker-compose.admin-writer.yml'),'utf8');
  const config=yaml.load(source.replace(/\$\{([A-Z_]+):?\?[^}]+\}/g,(_m,k)=>{if(!Object.hasOwn(values,k))throw Error('missing synthetic input '+k);return JSON.stringify(values[k]);}));
  // Compose's rendered --format=json representation (not a Compose execution proof).
  config.name=project;
  for(const s of Object.values(config.services)) s.networks=Object.fromEntries(s.networks.map(n=>[n,null]));
  const put=(name,bytes)=>{const p=path.join(dir,name);fs.writeFileSync(p,bytes,{mode:0o600});return {path:p,sha256:sha(bytes)};};
  const files=[put('compose.json',JSON.stringify(config))],envFile=put('bound.env','');
  const mountFiles={runtime:put('runtime',JSON.stringify({version:1,service:binding.service,generation:binding.generation,environment:'production'})),
    writerDb:put('writer-db','postgresql://ssb_admin_writer:synthetic-only@db:5432/synthetic'),writerKey:put('key','k'.repeat(64))};
  const images={api:image(1),'admin-writer':image(1),dashboard:image(2),reporter:image(3),widget:image(4)};
  const c={version:3,service:selected,project,action:'start-retained',platform:'linux/amd64',fileUid:1000,
    bootstrap:true,previousGeneration:'previous',predecessors:[],containerNames:Object.fromEntries(Object.keys(images).map(s=>[s,`${project}-${s}`])),
    timeoutMs:1000,docker:'/synthetic/docker',dockerHost:'unix:///var/run/docker.sock',daemonId:'synthetic-daemon-identity',
    files,envFile,images,imageId:images[selected],mountFiles,database:{host:'db',port:5432,name:'synthetic'},
    roles:{runtime:'ssb_runtime',writer:'ssb_admin_writer',reporter:'ssb_reporter',migrator:'ssb_migrator',ledger:'maintenance_admin.writer_receipts'},
    serviceNetworks:Object.fromEntries(Object.entries(config.services).map(([k,s])=>[k,Object.keys(s.networks)])),
    ports:Object.fromEntries(Object.keys(images).map(k=>[k,[]])),networks:{},
    operatingEnvironmentSha256:Object.fromEntries(Object.entries(config.services).map(([k,s])=>[k,policy.operatingDigest(k,s.environment||{})]))};
  if(fs.existsSync(path.join(binding.root,'runtime-state.json'))) {
    const d=JSON.parse(fs.readFileSync(path.join(binding.root,'runtime-state.json'))).deployment;
    if(d) {c.bootstrap=d.bootstrap;c.previousGeneration=d.previousGeneration;}
  }
  Object.entries(config.networks).forEach(([k,n],i)=>{c.networks[k]={name:n.name,id:String(i+5).repeat(64),internal:['internal','admin_writer'].includes(k)};});
  const imageConfig={User:selected==='widget'?'':'node',Cmd:policy.commands[selected==='admin-writer'?'api':selected],
    Entrypoint:selected==='widget'?['/docker-entrypoint.sh']:selected==='dashboard'?['docker-entrypoint.sh']:[],Labels:{'com.ssb.maintenance-protocol':'2','com.ssb.shutdown-protocol':'1','com.ssb.reporter-lifecycle':'1'},Env:[]};
  const inspect=[{Id:c.imageId,Os:'linux',Architecture:'amd64',Config:imageConfig}];
  const s=config.services[selected],container={Id:'d'.repeat(64),Name:'/'+c.containerNames[selected],Image:c.imageId,
    Config:{User:s.user,Cmd:s.command||imageConfig.Cmd,Entrypoint:imageConfig.Entrypoint,
      Labels:{'com.docker.compose.project':project,'com.docker.compose.service':selected},Env:Object.entries(s.environment||{}).map(([k,v])=>`${k}=${v}`)},
    State:{Status:'created',Running:false,Paused:false,Restarting:false,OOMKilled:false},
    HostConfig:{Privileged:false,ReadonlyRootfs:Boolean(s.read_only),RestartPolicy:{Name:'no'},SecurityOpt:s.security_opt,
      CapDrop:s.cap_drop||[],NetworkMode:c.networks[c.serviceNetworks[selected][0]].name,
      Tmpfs:Object.fromEntries((s.tmpfs||[]).map(v=>{const i=v.indexOf(':');return [v.slice(0,i),v.slice(i+1)];}))},
    Mounts:(s.volumes||[]).map(v=>({Type:'bind',Source:v.source,Destination:v.target,RW:!v.read_only,Propagation:'rprivate'})),
    NetworkSettings:{Networks:Object.fromEntries(c.serviceNetworks[selected].map(k=>[c.networks[k].name,{NetworkID:''}]))}};
  t.mock.method(policy,'verifyFiles',(b,plan)=>{
    const fst=fs.fstatSync,lst=fs.lstatSync;
    const privateInodes=new Set(Object.values(mountFiles).map(f=>fs.statSync(f.path).ino));
    fs.fstatSync=(fd,...args)=>{const s=fst(fd,...args);s.uid=privateInodes.has(s.ino)?1000:0;return s;};
    fs.lstatSync=(p,...args)=>{const s=lst(p,...args);if(p===binding.root)s.uid=1000;return s;};
    try{return verifyRealFiles(b,plan);}finally{fs.fstatSync=fst;fs.lstatSync=lst;}
  });
  const calls=[];
  async function execute(_binary,args,options){
    calls.push({args,options});
    if(args[0]!=='--host'||args[1]!==c.dockerHost)throw Error('unbound daemon');
    args=args.slice(2);
    if(args[0]==='info')return {stdout:JSON.stringify({ID:c.daemonId,OSType:'linux',Architecture:'x86_64'})};
    if(args[0]==='image')return {stdout:JSON.stringify(inspect)};
    if(args[0]==='network') {const n=Object.values(c.networks).find(n=>n.id===args[2]);return {stdout:JSON.stringify([{Id:n.id,Name:n.name,Internal:n.internal,Driver:'bridge',Scope:'local'}])};}
    if(args.includes('config'))return {stdout:JSON.stringify(config)};
    if(args.includes('create'))return {stdout:''};
    if(args[0]==='container'&&args[1]==='ls')return {stdout:''};
    if(args[0]==='container'&&args[1]==='inspect')return {stdout:JSON.stringify([container])};
    if(args[0]==='container'&&args[1]==='start') {
      container.State.Status='running';container.State.Running=true;
      for(const k of c.serviceNetworks[selected])container.NetworkSettings.Networks[c.networks[k].name].NetworkID=c.networks[k].id;
      return {stdout:container.Id};
    }
    throw Error('unexpected synthetic invocation');
  }
  return {c,config,inspect,container,execute,calls,dir};
}
module.exports={fixture};
