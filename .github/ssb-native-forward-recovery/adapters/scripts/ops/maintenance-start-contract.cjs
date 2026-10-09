'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MaintenanceDenied } = require('../../apps/api/dist/maintenance/maintenance-state');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const deny = (ok, code) => { if (!ok) throw new MaintenanceDenied(code); };
const ids = value => /^sha256:[a-f0-9]{64}$/.test(value || '');
const keys = value => Object.keys(value || {}).sort();
const serviceNames = ['api', 'admin-writer', 'dashboard', 'reporter', 'widget'];
const commands = { api: ['node','dist/main.js'], 'admin-writer': ['node','dist/admin-writer/server.js'],
  dashboard: ['node','app/server.js'], reporter: ['node','dist/main.js','weekly'], widget: ['nginx','-g','daemon off;'] };
const targets = { state: '/run/ssb-maintenance', runtime: '/run/ssb-runtime-contract.json',
  writerDb: '/run/ssb-writer-db', writerKey: '/run/ssb-writer-signing-key' };
const mounts = { api: ['state','runtime'], 'admin-writer': ['state','runtime','writerDb','writerKey'],
  dashboard: ['writerKey'], reporter: ['state'], widget: [] };
const serviceNetworks = {api:['internal','egress','widget_api'], 'admin-writer':['internal','admin_writer'],
  dashboard:['internal','admin_writer','ingress'],reporter:['internal','egress'],widget:['widget_api','ingress']};
const tmpfs = { api: ['/tmp:rw,nosuid,size=16m'], 'admin-writer': [],
  dashboard: ['/tmp:rw,nosuid,size=16m'], reporter: [],
  widget: ['/tmp:rw,nosuid,size=16m','/var/cache/nginx:rw,nosuid,size=16m','/var/run:rw,nosuid,size=1m'] };
// Bound to the reviewed private deployment snapshot, never printed in diagnostics.
const operatingKeys = {
  api: ['REDIS_URL','OPENAI_API_KEY','ADMIN_KEY','ADMIN_SESSION_SECRET','DASHBOARD_INTERNAL_TOKEN',
    'OPENAI_MODEL','OPENAI_EMBED_MODEL','SITE_PILOT_ACCESS_RULES_JSON','INTEGRATION_SECRET_KEY',
    'INTEGRATION_SECRET_KEY_PREVIOUS','INTEGRATION_SECRET_LEGACY_KEYS','ADMIN_DOMAIN','API_DOMAIN',
    'WIDGET_DOMAIN','SITE_DOMAIN_ALLOWLIST_MODE','CORS_ALLOWED_ORIGINS','PUBLIC_API_BASE_URL',
    'PUBLIC_WIDGET_BUNDLE_URL','NEXT_PUBLIC_WIDGET_LOADER_URL','SMTP_HOST','SMTP_PORT','SMTP_USER',
    'SMTP_PASS','REPORTS_FROM_EMAIL','LEAD_NOTIFICATION_EMAIL','ADMIN_EMAIL','APP_URL'],
  dashboard: ['ADMIN_SESSION_SECRET','DASHBOARD_INTERNAL_TOKEN','ADMIN_PANEL_PASSWORD_HASH',
    'DASHBOARD_PUBLIC_URL','REDIS_URL','NEXT_PUBLIC_WIDGET_LOADER_URL','OPERATOR_PANEL_PASSWORD_HASH'],
  reporter: ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','REPORTS_FROM_EMAIL'],
  'admin-writer': ['ADMIN_SESSION_SECRET','DASHBOARD_INTERNAL_TOKEN'], widget: [],
};
const allowedEmpty = new Set(['INTEGRATION_SECRET_KEY_PREVIOUS','INTEGRATION_SECRET_LEGACY_KEYS',
  'CORS_ALLOWED_ORIGINS','LEAD_NOTIFICATION_EMAIL','ADMIN_EMAIL','APP_URL','OPERATOR_PANEL_PASSWORD_HASH']);
function operatingDigest(service, env) {
  const entries=operatingKeys[service].map(k=>[k,env[k]]);
  deny(entries.every(([k,v])=>typeof v==='string' && (allowedEmpty.has(k)||v.trim())), 'operating_binding_missing');
  return hash(JSON.stringify(entries));
}

function readBoundFile(file, uid) {
  deny(file && path.isAbsolute(file.path || '') && /^[a-f0-9]{64}$/.test(file.sha256 || ''), 'file_binding_invalid');
  const fd = fs.openSync(file.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    deny(s.isFile() && s.size <= 1024*1024 && s.nlink === 1 && (s.mode & 0o777) === 0o600 && s.uid === uid,
      'private_file_binding_changed');
    const bytes = fs.readFileSync(fd);
    deny(hash(bytes) === file.sha256, 'private_file_binding_changed');
    return bytes;
  } finally { fs.closeSync(fd); }
}

function assertPlan(binding, c) {
  deny(c?.version === 3 && serviceNames.includes(c.service) && c.project === `${binding.service}-${binding.generation}`
    && /^[a-z0-9][a-z0-9_-]{0,119}$/.test(c.project)
    && c.action === 'start-retained' && c.platform === 'linux/amd64' && c.fileUid === 1000
    && Number.isSafeInteger(c.timeoutMs) && c.timeoutMs > 0 && c.timeoutMs <= 10000
    && path.isAbsolute(c.docker || '') && c.dockerHost === 'unix:///var/run/docker.sock'
    && typeof c.daemonId === 'string' && c.daemonId.length > 10
    && Array.isArray(c.files) && c.files.length > 0 && c.envFile
    && same(keys(c.images), [...serviceNames].sort()) && Object.values(c.images).every(ids)
    && c.imageId === c.images[c.service] && c.images.api === c.images['admin-writer']
    && c.roles?.runtime === 'ssb_runtime' && c.roles?.writer === 'ssb_admin_writer'
    && c.roles?.reporter === 'ssb_reporter' && c.roles?.migrator === 'ssb_migrator'
    && c.roles?.ledger === 'maintenance_admin.writer_receipts'
    && c.database?.host && /^[A-Za-z0-9_-]+$/.test(c.database.name || '')
    && Number.isInteger(c.database.port) && c.database.port > 0 && c.database.port <= 65535,
  'deployment_contract_invalid');
  deny(typeof c.bootstrap === 'boolean' && /^[a-zA-Z0-9_-]{1,128}$/.test(c.previousGeneration || '')
    && c.previousGeneration !== binding.generation && same(keys(c.containerNames), [...serviceNames].sort())
    && serviceNames.every(s=>c.containerNames[s]===`${c.project}-${s}` && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(c.containerNames[s]))
    && Array.isArray(c.predecessors) && (c.bootstrap ? c.predecessors.length===0 : c.predecessors.length===5),
  'retained_generation_binding_invalid');
  if(!c.bootstrap) deny(same(c.predecessors.map(p=>p.service).sort(),[...serviceNames].sort())
    && new Set(c.predecessors.map(p=>p.id)).size===5 && c.predecessors.every(p=>
      /^[a-f0-9]{64}$/.test(p.id||'') && ids(p.imageId) && p.project===`${binding.service}-${c.previousGeneration}`
      && p.name===`${p.project}-${p.service}` && p.name!==c.containerNames[p.service]
      && (!['api','admin-writer'].includes(p.service) || p.receipt?.path===path.join(binding.root,`shutdown-${p.name}.json`))),
  'predecessor_binding_invalid');
  deny(same(keys(c.mountFiles), ['runtime','writerDb','writerKey'])
    && Array.isArray(c.serviceNetworks?.[c.service]) && c.serviceNetworks[c.service].length > 0
    && new Set(c.serviceNetworks[c.service]).size === c.serviceNetworks[c.service].length
    && c.networks && c.ports && Object.hasOwn(c.ports,c.service), 'deployment_binding_missing');
  deny(c.serviceNetworks[c.service].every(n => c.networks[n]?.name && ids('sha256:' + c.networks[n].id)
    && typeof c.networks[n].internal === 'boolean'), 'network_binding_invalid');
  if(c.service === 'admin-writer') deny(same([...c.serviceNetworks[c.service]].sort(),['admin_writer','internal'])
    && c.serviceNetworks[c.service].every(n=>c.networks[n].internal), 'writer_network_not_private');
  deny(same(keys(c.serviceNetworks),keys(serviceNetworks)) && Object.entries(serviceNetworks).every(([s,n])=>
    Array.isArray(c.serviceNetworks[s]) && same([...c.serviceNetworks[s]].sort(),[...n].sort()))
    && same(keys(c.networks),['admin_writer','egress','ingress','internal','widget_api'])
    && new Set(Object.values(c.networks).map(n=>n.id)).size===5
    && new Set(Object.values(c.networks).map(n=>n.name)).size===5,'service_network_separation_invalid');
  deny(Array.isArray(c.ports[c.service]) && !c.ports[c.service].length, 'port_binding_invalid');
  deny(/^[a-f0-9]{64}$/.test(c.operatingEnvironmentSha256?.[c.service]||''), 'operating_binding_missing');
  const paths = [...c.files.map(f => f.path), c.envFile.path, ...Object.values(c.mountFiles).map(f => f.path)];
  deny(new Set(paths).size === paths.length && paths.every(p => path.isAbsolute(p || ''))
    && !paths.includes(binding.root) && path.isAbsolute(binding.root || ''), 'ambiguous_file_bindings');
  deny(paths.every(p=>{const rel=path.relative(binding.root,p);return rel.startsWith('..'+path.sep)||rel==='..';}), 'private_files_inside_shared_state');
}

function verifyFiles(binding, c) {
  // No parent-symlink aliases or private files reachable through the common RW tree.
  for(const p of [binding.root,...c.files.map(f=>f.path),c.envFile.path,...Object.values(c.mountFiles).map(f=>f.path)]) {
    deny(fs.realpathSync(p)===p,'noncanonical_binding_path');
  }
  for (const f of [...c.files,c.envFile]) readBoundFile(f, 0);
  const state = fs.lstatSync(binding.root);
  deny(state.isDirectory() && !state.isSymbolicLink() && state.uid === c.fileUid
    && (state.mode & 0o777) === 0o700, 'state_mount_invalid');
  for (const f of Object.values(c.mountFiles)) readBoundFile(f,c.fileUid);
  const runtime = JSON.parse(readBoundFile(c.mountFiles.runtime,c.fileUid));
  deny(runtime.version === 1 && runtime.service === binding.service && runtime.generation === binding.generation
    && runtime.environment === 'production', 'runtime_file_binding_invalid');
  databaseUrl(readBoundFile(c.mountFiles.writerDb,c.fileUid).toString().trim(), 'ssb_admin_writer', c);
  deny(readBoundFile(c.mountFiles.writerKey,c.fileUid).toString().trim().length >= 64, 'writer_key_invalid');
}

function databaseUrl(value, role, c) {
  let u;
  try { u = new URL(value); } catch { throw new MaintenanceDenied('database_binding_invalid'); }
  deny(['postgres:','postgresql:'].includes(u.protocol) && decodeURIComponent(u.username) === role
    && u.password && u.hostname === c.database.host && Number(u.port || 5432) === c.database.port
    && decodeURIComponent(u.pathname) === '/' + c.database.name && !u.search && !u.hash, 'database_binding_invalid');
}

function assertImage(image, c) {
  deny(Array.isArray(image) && image.length === 1 && image[0].Id === c.imageId
    && image[0].Os === 'linux' && image[0].Architecture === 'amd64' && image[0].Config
    && typeof image[0].Config === 'object' && !Array.isArray(image[0].Config), 'image_identity_invalid');
  const cfg = image[0].Config, app = c.service !== 'widget';
  deny(app ? cfg.User === 'node' : (cfg.User === undefined || cfg.User === ''), 'image_user_invalid');
  const command = c.service === 'admin-writer' ? commands.api : commands[c.service];
  deny(same(cfg.Cmd,command) && (c.service === 'dashboard' ? same(cfg.Entrypoint,['docker-entrypoint.sh']) : app ? (cfg.Entrypoint == null || same(cfg.Entrypoint,[]))
    : same(cfg.Entrypoint,['/docker-entrypoint.sh'])), 'image_command_invalid');
  if (['api','admin-writer','reporter'].includes(c.service)) deny(cfg.Labels?.['com.ssb.maintenance-protocol'] === '2', 'image_not_instrumented');
  if (c.service === 'reporter') deny(cfg.Labels?.['com.ssb.reporter-lifecycle'] === '1', 'image_reporter_lifecycle_missing');
  if (['api','admin-writer'].includes(c.service)) {
    deny(cfg.Labels?.['com.ssb.shutdown-protocol']==='1','image_shutdown_protocol_missing');
    deny(cfg.StopSignal===undefined || cfg.StopSignal==='SIGTERM','image_stop_signal_invalid');
  }
  deny(cfg.Volumes === undefined || cfg.Volumes === null || same(cfg.Volumes,{}), 'image_volume_forbidden');
  deny(!cfg.Healthcheck || same(cfg.Healthcheck,{Test:['NONE']}),'image_healthcheck_forbidden');
  return cfg;
}

function assertCompose(binding, c, config, cfg) {
  deny(config?.name === c.project && same(keys(config.services),[...serviceNames].sort()), 'compose_project_invalid');
  deny(cfg.Env == null || Array.isArray(cfg.Env) && cfg.Env.every(v=>typeof v==='string' && v.includes('=')), 'image_environment_invalid');
  const s = config.services[c.service], e = { ...Object.fromEntries((cfg.Env || []).map(v=>v.split(/=(.*)/s).slice(0,2))), ...s?.environment };
  deny(s && s.image === c.imageId && same(s.command || cfg.Cmd,commands[c.service])
    && s.container_name === c.containerNames[c.service] && !s.depends_on && !s.build && !s.links?.length && !s.init
    && same(s.entrypoint ?? cfg.Entrypoint ?? [],cfg.Entrypoint ?? [])
    && s.pull_policy === 'never' && s.restart === 'no'
    && s.user === (c.service === 'widget' ? '0:0' : '1000:1000')
    && !s.privileged && !s.pid && !s.ipc && !s.network_mode && !s.devices?.length && !s.gpus
    && !s.cgroup && !s.cgroup_parent && !s.sysctls && !s.use_api_socket
    && !s.post_start?.length && !s.pre_stop?.length && !s.healthcheck && !s.stop_signal
    && !s.volumes_from?.length && !s.cap_add?.length && !s.secrets?.length && !s.configs?.length
    && same(s.cap_drop || [],c.service === 'admin-writer' ? ['ALL'] : [])
    && same(s.security_opt,['no-new-privileges:true'])
    && Boolean(s.read_only) === ['admin-writer','widget'].includes(c.service)
    && same(s.tmpfs || [],tmpfs[c.service]), 'start_security_invalid');
  const expected = mounts[c.service].map(key=>({type:'bind',source:key==='state'?binding.root:c.mountFiles[key].path,target:targets[key],read_only:key!=='state'}));
  const volumes = s.volumes || [];
  deny(Array.isArray(volumes) && volumes.length === expected.length && expected.every(w=>volumes.some(v=>
    v.type===w.type && v.source===w.source && v.target===w.target && Boolean(v.read_only)===w.read_only
    && v.bind?.create_host_path===false && !v.bind?.propagation && !v.bind?.selinux)), 'start_mount_invalid');
  deny(same(keys(s.networks), [...c.serviceNetworks[c.service]].sort()), 'start_network_invalid');
  for (const n of c.serviceNetworks[c.service]) {
    const net=config.networks?.[n];deny(net?.name===c.networks[n].name && net.external===true, 'compose_network_invalid');
  }
  deny(same(s.ports || [],c.ports[c.service]), 'start_ports_invalid');
  deny(!Object.keys(e).some(k=>k.startsWith('PG') && e[k]), 'implicit_pg_environment_forbidden');
  deny(!Object.keys(e).some(k=>/^(NODE_OPTIONS|NODE_PATH|LD_.*|DYLD_.*|BASH_ENV|ENV)$/.test(k)&&e[k]), 'alternate_start_environment_forbidden');
  const forbidden = ['MIGRATOR_DATABASE_URL_FILE','MAINTENANCE_OPERATOR_FILE'];
  if(c.service !== 'admin-writer') forbidden.push('ADMIN_WRITER_DATABASE_URL_FILE');
  if(!['admin-writer','dashboard'].includes(c.service)) forbidden.push('ADMIN_WRITER_SIGNING_KEY_FILE');
  if(c.service !== 'api') forbidden.push('DATABASE_URL','DATABASE_URL_FILE','OPENAI_API_KEY','ADMIN_KEY');
  if(!['api','dashboard'].includes(c.service)) forbidden.push('REDIS_URL');
  deny(forbidden.every(k=>!e[k]),'service_credentials_forbidden');
  deny(operatingDigest(c.service,e)===c.operatingEnvironmentSha256[c.service], 'operating_binding_changed');
  if(['api','admin-writer','reporter'].includes(c.service)) deny(e.NODE_ENV==='production' && e.APP_ENV==='production'
    && e.MAINTENANCE_STATE_ROOT===targets.state && e.MAINTENANCE_SERVICE===binding.service
    && e.MAINTENANCE_GENERATION===binding.generation,'maintenance_binding_invalid');
  if(['api','admin-writer'].includes(c.service)) deny(e.ADMIN_WRITER_RUNTIME_FILE===targets.runtime
    && e.MAINTENANCE_PARTICIPANT_ID===c.containerNames[c.service]
    && e.MAINTENANCE_IMAGE_ID===c.imageId,'runtime_binding_missing');
  if(c.service==='api') {
    databaseUrl(e.DATABASE_URL,'ssb_runtime',c);
    deny(e.RUN_MIGRATIONS_ON_STARTUP==='false' && e.ALLOW_PRODUCTION_AUTO_MIGRATIONS==='false','startup_migration_forbidden');
    const rules=JSON.parse(e.SITE_PILOT_ACCESS_RULES_JSON);
    deny(Array.isArray(rules),'pilot_binding_invalid');
  }
  if(c.service==='admin-writer') deny(e.ADMIN_WRITER_DATABASE_URL_FILE===targets.writerDb
    && e.ADMIN_WRITER_SIGNING_KEY_FILE===targets.writerKey && e.ADMIN_SESSION_SECRET?.length>=32
    && e.DASHBOARD_INTERNAL_TOKEN?.length>=32,'writer_binding_missing');
  if(c.service==='dashboard') deny(e.NODE_ENV==='production' && e.APP_ENV==='production'
    && e.ADMIN_WRITER_BASE_URL==='http://admin-writer:3011' && e.DASHBOARD_INTERNAL_TOKEN?.length>=32
    && e.ADMIN_WRITER_SIGNING_KEY_FILE===targets.writerKey,'dashboard_writer_binding_missing');
  if(c.service==='dashboard') {
    let origin;try{origin=new URL(e.DASHBOARD_PUBLIC_URL);}catch{throw new MaintenanceDenied('dashboard_origin_invalid');}
    deny(origin.protocol==='https:' && !origin.username && !origin.password && !origin.search && !origin.hash
      && origin.pathname==='/', 'dashboard_origin_invalid');
    deny(e.REDIS_URL===config.services.api?.environment?.REDIS_URL,'dashboard_redis_binding_invalid');
  }
  if(['api','reporter'].includes(c.service)) {
    const api=config.services.api?.environment, reporter=config.services.reporter?.environment;
    deny(api?.REPORTER_API_TOKEN?.length>=32 && api.REPORTER_API_TOKEN===reporter?.REPORTER_API_TOKEN
      && api.REPORTER_SITE_BINDINGS===reporter.REPORTER_SITE_BINDINGS,'reporter_pair_binding_invalid');
    const list=JSON.parse(api.REPORTER_SITE_BINDINGS);
    deny(Array.isArray(list) && list.length>0 && list.every(b=>same(keys(b),['siteId','tenantId'])
      && /^[A-Za-z0-9_-]+$/.test(b.siteId) && /^[A-Za-z0-9_-]+$/.test(b.tenantId))
      && new Set(list.map(b=>b.siteId)).size===list.length,'reporter_scope_invalid');
    if(c.service==='reporter') deny(e.REPORTER_API_BASE_URL==='http://api:5000','reporter_origin_invalid');
  }
}

function assertPredecessor(binding,c,p,list) {
  deny(Array.isArray(list)&&list.length===1,'predecessor_missing');
  const x=list[0],s=x.State,l=x.Config?.Labels;
  deny(x.Id===p.id && x.Name===`/${p.name}` && x.Image===p.imageId
    && l?.['com.docker.compose.project']===p.project && l?.['com.docker.compose.service']===p.service
    && s?.Status==='exited' && s.Running===false && s.Paused===false && s.Restarting===false && s.OOMKilled===false
    && [0,143].includes(s.ExitCode) && x.HostConfig?.RestartPolicy?.Name==='no', 'predecessor_not_stopped');
  if(['api','admin-writer'].includes(p.service)) {
    const r=JSON.parse(readBoundFile(p.receipt,c.fileUid)),at=Date.parse(r.recordedAt);
    deny(s.ExitCode===0 && r.version===1 && r.status==='graceful' && r.component===p.service
      && r.service===binding.service && r.generation===c.previousGeneration && r.participant===p.name
      && r.imageId===p.imageId && r.remainingWork===0 && r.poolsClosed===true
      && Number.isFinite(r.elapsedMs) && r.elapsedMs>=0 && r.elapsedMs<7000
      && Number.isFinite(at) && at>=Date.parse(s.StartedAt) && at<=Date.parse(s.FinishedAt), 'predecessor_shutdown_unverified');
  }
}

function assertContainer(binding,c,config,image,list,status,expectedId) {
  deny(Array.isArray(list)&&list.length===1,'container_missing');
  const x=list[0],cfg=x.Config,h=x.HostConfig,s=config.services[c.service];
  deny(/^[a-f0-9]{64}$/.test(x.Id||'') && (!expectedId||x.Id===expectedId)
    && x.Name===`/${c.containerNames[c.service]}` && x.Image===c.imageId && x.State?.Status===status
    && x.State.Running===(status==='running') && x.State.Paused===false && x.State.Restarting===false
    && x.State.OOMKilled===false && cfg?.Labels?.['com.docker.compose.project']===c.project
    && cfg.Labels['com.docker.compose.service']===c.service && cfg.User===s.user
    && same(cfg.Cmd,commands[c.service]) && same(cfg.Entrypoint??[],image.Entrypoint??[]), 'container_identity_invalid');
  const env=Object.fromEntries((image.Env||[]).map(v=>v.split(/=(.*)/s).slice(0,2)));
  Object.assign(env,s.environment||{});
  deny(Array.isArray(cfg.Env) && same([...cfg.Env].sort(),Object.entries(env).map(([k,v])=>`${k}=${v}`).sort()),'container_environment_invalid');
  deny(h && h.Privileged===false && h.ReadonlyRootfs===Boolean(s.read_only) && h.RestartPolicy?.Name==='no'
    && same(h.SecurityOpt,['no-new-privileges:true']) && !Object.keys(h.PortBindings||{}).length
    && !h.PublishAllPorts && !h.Devices?.length && !h.DeviceRequests?.length && !h.CapAdd?.length
    && !h.PidMode && ['', 'private'].includes(h.IpcMode||'') && !h.VolumesFrom?.length
    && same(h.CapDrop||[],s.cap_drop||[]), 'container_security_invalid');
  const expected=mounts[c.service].map(k=>({Source:k==='state'?binding.root:c.mountFiles[k].path,Destination:targets[k],RW:k==='state'}));
  const actual=x.Mounts?.filter(m=>m.Type!=='tmpfs');
  deny(Array.isArray(actual)&&actual.length===expected.length&&expected.every(w=>actual.some(m=>
    m.Type==='bind'&&m.Source===w.Source&&m.Destination===w.Destination&&m.RW===w.RW&&['rprivate',''].includes(m.Propagation||''))), 'container_mount_invalid');
  const expectedTmpfs=Object.fromEntries((s.tmpfs||[]).map(v=>{const i=v.indexOf(':');return [v.slice(0,i),v.slice(i+1)];}));
  deny(same(keys(h.Tmpfs),keys(expectedTmpfs))&&Object.entries(expectedTmpfs).every(([k,v])=>h.Tmpfs[k]===v),'container_tmpfs_invalid');
  const nets=x.NetworkSettings?.Networks,wanted=c.serviceNetworks[c.service].map(k=>c.networks[k]);
  deny(same(keys(nets),wanted.map(n=>n.name).sort()) && wanted.some(n=>h.NetworkMode===n.name||h.NetworkMode===n.id)
    && wanted.every(n=>nets[n.name]?.NetworkID===n.id||status==='created'&&nets[n.name]?.NetworkID===''), 'container_network_invalid');
  return x.Id;
}
module.exports = { assertPlan, verifyFiles, assertImage, assertCompose, assertPredecessor, assertContainer,
  readBoundFile, databaseUrl, commands, targets, mounts, tmpfs, operatingDigest };
