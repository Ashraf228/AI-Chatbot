'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomBytes,scryptSync}=require('node:crypto');
const {sha,need}=require('./common.cjs');
const services=['api','admin-writer','dashboard','reporter','widget'];
const networks=['internal','admin_writer','widget_api','ingress','egress'];
const secret=()=>randomBytes(32).toString('hex');
function write(file,bytes,uid=0){fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});fs.chownSync(file,uid,uid);return{path:file,sha256:sha(bytes)};}
function expand(value,values){
  if(typeof value==='string')return value.replace(/\$\{([A-Z_]+):?\?[^}]+\}/g,(_m,k)=>{need(Object.hasOwn(values,k),'missing_fixture_binding');return values[k];});
  if(Array.isArray(value))return value.map(x=>expand(x,values));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v,values)]));return value;
}
function composeLiteral(value){
  if(typeof value==='string')return value.replace(/\$/g,()=> '$$');
  if(Array.isArray(value))return value.map(composeLiteral);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,composeLiteral(v)]));
  return value;
}
function secrets(){const password=secret(),salt=randomBytes(16);return{password,passwordHash:`scrypt$${salt.toString('hex')}$${scryptSync(password,salt,64).toString('hex')}`,writerKey:secret(),session:secret(),internal:secret(),reporter:secret(),admin:secret(),integration:secret(),owner:secret(),passwords:Object.fromEntries(['postgres','ssb_runtime','ssb_admin_writer','ssb_reporter','ssb_migrator'].map(k=>[k,secret()]))};}
function generation(native,generation,previous,predecessors,policyOverride){
  const root=path.join(native.privateRoot,generation);fs.mkdirSync(root,{mode:0o711});
  const binding={root:native.stateRoot,service:native.prefix,generation};
  const project=`${native.prefix}-${generation}`,s=native.synthetic,images=native.images;
  const names=Object.fromEntries(services.map(k=>[k,`${project}-${k}`]));
  const mountFiles={runtime:write(path.join(root,'runtime.json'),JSON.stringify({version:1,service:native.prefix,generation,environment:'production',query_embedding:{providerKey:'openai',model:'text-embedding-3-small',supported:true},llm_generation:{providerKey:'openai',model:'synthetic-disabled',supported:false}}),1000),writerKey:write(path.join(root,'writer-key'),s.writerKey,1000),writerDb:write(path.join(root,'writer-db'),`postgresql://ssb_admin_writer:${s.passwords.ssb_admin_writer}@db:5432/synthetic`,1000)};
  const values={
    MAINTENANCE_HOST_STATE:native.stateRoot,MAINTENANCE_SERVICE:native.prefix,MAINTENANCE_GENERATION:generation,
    RETAINED_API_NAME:names.api,RETAINED_WRITER_NAME:names['admin-writer'],RETAINED_DASHBOARD_NAME:names.dashboard,RETAINED_REPORTER_NAME:names.reporter,RETAINED_WIDGET_NAME:names.widget,
    ADMIN_WRITER_RUNTIME_HOST_FILE:mountFiles.runtime.path,ADMIN_WRITER_KEY_HOST_FILE:mountFiles.writerKey.path,ADMIN_WRITER_DB_HOST_FILE:mountFiles.writerDb.path,
    ADMIN_WRITER_API_IMAGE:images.api,ADMIN_WRITER_DASHBOARD_IMAGE:images.dashboard,ADMIN_WRITER_REPORTER_IMAGE:images.reporter,ADMIN_WRITER_WIDGET_IMAGE:images.widget,
    RUNTIME_DATABASE_URL:`postgresql://ssb_runtime:${s.passwords.ssb_runtime}@db:5432/synthetic`,REDIS_URL:'redis://redis:6379',
    OPENAI_API_KEY:'synthetic-no-provider',ADMIN_KEY:s.admin,ADMIN_SESSION_SECRET:s.session,DASHBOARD_INTERNAL_TOKEN:s.internal,REPORTER_API_TOKEN:s.reporter,
    REPORTER_SITE_BINDINGS:JSON.stringify([{siteId:'synthetic-site',tenantId:'synthetic-tenant'}]),OPENAI_EMBED_MODEL:'text-embedding-3-small',OPENAI_MODEL:'synthetic-disabled',
    ADMIN_PANEL_PASSWORD_HASH:s.passwordHash,DASHBOARD_PUBLIC_URL:'https://synthetic.invalid',OPERATOR_PANEL_PASSWORD_HASH:'',
    SMTP_HOST:'smtp-blocked.invalid',SMTP_PORT:'9',SMTP_USER:'synthetic-disabled',SMTP_PASS:'synthetic-disabled',REPORTS_FROM_EMAIL:'test@example.invalid',
    SITE_PILOT_ACCESS_RULES_JSON:'[]',INTEGRATION_SECRET_KEY:s.integration,INTEGRATION_SECRET_KEY_PREVIOUS:'',INTEGRATION_SECRET_LEGACY_KEYS:'',
    ADMIN_DOMAIN:'synthetic.invalid',API_DOMAIN:'api.synthetic.invalid',WIDGET_DOMAIN:'widget.synthetic.invalid',SITE_DOMAIN_ALLOWLIST_MODE:'strict',CORS_ALLOWED_ORIGINS:'https://synthetic.invalid',
    PUBLIC_API_BASE_URL:'https://api.synthetic.invalid',PUBLIC_WIDGET_BUNDLE_URL:'https://widget.synthetic.invalid/widget.js',NEXT_PUBLIC_WIDGET_LOADER_URL:'https://widget.synthetic.invalid/loader.js',
    LEAD_NOTIFICATION_EMAIL:'',ADMIN_EMAIL:'',APP_URL:'',
    BOUND_INTERNAL_NETWORK:native.networks.internal.name,BOUND_WRITER_NETWORK:native.networks.admin_writer.name,BOUND_WIDGET_API_NETWORK:native.networks.widget_api.name,BOUND_INGRESS_NETWORK:native.networks.ingress.name,BOUND_EGRESS_NETWORK:native.networks.egress.name,
  };
  const config=expand(require('./compose-template.json'),values);config.name=project;
  for(const v of Object.values(config.services)){v.networks=Object.fromEntries(v.networks.map(k=>[k,{aliases:[]}])) ;v.mem_limit=v.image===images.api?'2g':'1g';v.pids_limit=256;v.cpus=1;v.labels={'com.ssb.native-run':native.options.run};}
  // Compose interpolates even JSON strings. Bind file bytes separately from raw runtime values.
  const files=[write(path.join(root,'compose.json'),JSON.stringify(composeLiteral(config)))],envFile=write(path.join(root,'empty.env'),'');
  const policy=policyOverride||require(path.join(native.toolsRoot,'scripts/ops/maintenance-start-contract.cjs'));
  const common={version:3,project,action:'start-retained',platform:'linux/amd64',fileUid:1000,bootstrap:previous==='seed',previousGeneration:previous,predecessors,containerNames:names,
    timeoutMs:10000,docker:native.docker,dockerHost:'unix:///var/run/docker.sock',daemonId:native.daemonId,files,envFile,images,mountFiles,database:{host:'db',port:5432,name:'synthetic'},
    roles:{runtime:'ssb_runtime',writer:'ssb_admin_writer',reporter:'ssb_reporter',migrator:'ssb_migrator',ledger:'maintenance_admin.writer_receipts'},
    serviceNetworks:Object.fromEntries(services.map(k=>[k,Object.keys(config.services[k].networks)])),ports:Object.fromEntries(services.map(k=>[k,[]])),networks:native.networks,
    operatingEnvironmentSha256:Object.fromEntries(services.map(k=>[k,policy.operatingDigest(k,config.services[k].environment||{})]))};
  return {binding,root,config,common,names,project,generation,previous};
}
module.exports={generation,services,networks,write,secrets,expand};
