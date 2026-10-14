'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{randomUUID}=require('node:crypto');
const {sha,need,json,bound,regular,clock,Processes,failureRecord,GateError}=require('./common.cjs');
const {services,networks,secrets,write,generation}=require('./fixtures.cjs');
const {publicFailure,InitProgress}=require('./diagnostics.cjs');
const {stateArgs}=require('./state-launch.cjs');
const {prepareStateCode}=require('./state-code.cjs');
const SOURCE='94a25578e883a6d7bbd03f26c56735739f75e45e',BUILD_DATE='2026-10-09T00:00:00Z';
const GiB=1024**3,fullId=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function verifyBase(list,base){need(Array.isArray(list)&&list.length===1,'base_response_invalid');const x=list[0];need(x.Id===base.imageId&&x.Os==='linux'&&x.Architecture==='amd64'&&Array.isArray(x.RepoDigests)&&x.RepoDigests.some(r=>r===base.reference||r===base.reference.replace(/^library\//,'')),'base_identity_invalid');need(x.Config&&typeof x.Config==='object'&&!Array.isArray(x.Config),'base_config_invalid');for(const [k,v]of Object.entries(base.envVersionFields))need(x.Config.Env?.includes(`${k}=${v}`),'base_version_invalid');return x;}
function proofResult(stdout){const lines=stdout.toString().split('\n').filter(x=>x.startsWith('SSB_PROOF_JSON '));need(lines.length===1,'proof_receipt_missing');const r=json(lines[0].slice(15));need(r.verified===true,'proof_failed');return r;}
class Native{
  constructor(options){this.options=options;this.startedAt=clock();this.jobRemaining=process.env.SSB_JOB_DEADLINE_MS?Number(process.env.SSB_JOB_DEADLINE_MS)-Date.now():990000;this.deadline=this.startedAt+Math.min(990000,this.jobRemaining);this.owned=[];this.networks={};this.volumes=[];this.images={};this.previous=[];this.previousGeneration='seed';this.epoch=0;this.closed=false;this.pullCount=0;}
  async command(bin,args,options={}){if(!options.closure){this.resources();need(!this.resourceFailure,'resource_floor_observed');if(this.probeDeadline){const left=this.probeDeadline-clock()-30000;need(left>250,'probe_work_deadline');options={...options,ms:Math.min(options.ms||10000,left)};}}else options={...options,deadline:Math.min(this.deadline,this.probeDeadline||Infinity,this.closureDeadline||Infinity)};try{return await this.proc.run(bin,args,options);}catch(e){if(options.closure&&e.code==='evidence_write_failed'&&e.result?.closed&&e.result.code===0&&!e.result.signal){(this.diagnosticFailures??=[]).push(e);return e.result;}throw e;}}
  resources(){if(!this.proc)return;const s=fs.statfsSync(this.privateRoot);need(s.bavail*s.bsize>=4*GiB&&s.ffree>=200000,'disk_floor');const m=fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+) kB/m);need(m&&Number(m[1])*1024>=GiB,'memory_floor');}
  async d(args,options={}){if(!options.closure&&this.probeDeadline)need(clock()+250<this.probeDeadline-30000,'probe_work_deadline');const ms=this.probeDeadline&&!options.closure?Math.min(options.ms||10000,this.probeDeadline-clock()-30000):options.ms;return this.command(this.docker,['--host','unix:///var/run/docker.sock',...args],{...options,...(ms?{ms}:{})});}
  async inspect(id,options={}){return json((await this.d(['container','inspect',id],options)).stdout);}
  async inventory(){const r={};for(const [key,args]of Object.entries({containers:['container','ls','-aq','--no-trunc'],networks:['network','ls','-q','--no-trunc'],volumes:['volume','ls','-q'],images:['image','ls','-q','--no-trunc']})){r[key]=(await this.d(args)).stdout.toString().trim().split('\n').filter(Boolean).sort();}return r;}
  async preflight(){
    need(process.platform==='linux'&&process.arch==='x64'&&process.getuid()===0&&process.version==='v24.17.0','native_host_required');
    need(/^\d{13}$/.test(process.env.SSB_JOB_DEADLINE_MS||'')&&this.jobRemaining>30000&&this.jobRemaining<=990000,'job_deadline_binding');
    need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='Ashraf228/AI-Chatbot'&&process.env.RUNNER_ARCH==='X64'&&process.env.RUNNER_OS==='Linux'&&process.env.SSB_REPOSITORY_VISIBILITY==='public','free_public_runner_required');
    need(!process.env.DOCKER_CONTEXT&&!process.env.DOCKER_HOST&&!process.env.DOCKER_TLS_VERIFY&&!process.env.DOCKER_CERT_PATH,'daemon_override_forbidden');
    const manifestBytes=regular(path.join(__dirname,'publication-manifest.json'));need(sha(manifestBytes)===process.env.SSB_PUBLICATION_MANIFEST,'publication_manifest_changed');
    for(const f of json(manifestBytes).files)bound(path.resolve(__dirname,'../..',f.path),f);
    Object.defineProperty(this,'verifiedPublicationManifest',{value:sha(manifestBytes)});
    this.release=fs.realpathSync(process.env.SSB_RELEASE_ROOT);this.source=path.join(this.release,'.github/ssb-capacity-diagnostic/source');
    for(const f of require('./release-source-manifest.json').files)bound(path.join(this.source,f.path),f);
    for(const f of require('./dockerfile-manifest.json'))bound(path.join(this.release,f.path),f);
    this.prefix=`ssb-native-${this.options.run}`;this.privateRoot=`/var/tmp/${this.prefix}`;fs.mkdirSync(this.privateRoot,{mode:0o711});
    fs.mkdirSync(path.join(this.privateRoot,'raw'),{mode:0o700});this.proc=new Processes({deadline:this.deadline,privateRoot:path.join(this.privateRoot,'raw')});
    this.reporterSource=require('./reporter-source.cjs').prepare(this.release,this.privateRoot);
    this.docker='/usr/bin/docker';need(fs.statSync(this.docker).isFile(),'docker_path');
    const git=await this.command('/usr/bin/git',['-C',this.release,'rev-parse','HEAD']);need(git.stdout.toString().trim()===SOURCE,'source_commit_changed');
    need((await this.command('/usr/bin/git',['-C',this.release,'status','--porcelain'])).stdout.length===0,'release_worktree_changed');
    const info=json((await this.d(['info','--format','{{json .}}'])).stdout);need(info.OSType==='linux'&&['amd64','x86_64'].includes(info.Architecture)&&typeof info.ID==='string'&&info.ID.length>10,'daemon_binding');this.daemonId=info.ID;
    const disk=fs.statfsSync(this.privateRoot);need(disk.bavail*disk.bsize>=24*GiB,'initial_disk_floor');const m=fs.readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+) kB/m);need(m&&Number(m[1])*1024>=8*GiB,'initial_memory_floor');
    this.initial=await this.inventory();this.synthetic=secrets();this.replayId=randomUUID();
    this.watch=setInterval(()=>{try{this.resources();}catch{this.resourceFailure=true;for(const child of this.proc.children)try{process.kill(-child.pid,'SIGTERM');}catch{}}},250);
    this.toolsRoot=path.join(this.privateRoot,'host-tools');fs.cpSync(path.join(__dirname,'adapters'),this.toolsRoot,{recursive:true,force:false,errorOnExist:true});
    this.stateRoot=path.join(this.privateRoot,'state');fs.mkdirSync(this.stateRoot,{mode:0o700});fs.chownSync(this.stateRoot,1000,1000);
    Object.defineProperty(this,'stateEntry',{value:prepareStateCode(__dirname,this.privateRoot,json(manifestBytes))});
    await this.stateLoadCheck(false);
    return{verified:true,counts:[901,4],hashes:[sha(manifestBytes)]};
  }
  async bases(){
    for(const base of require('./registry-bindings.json').images){
      await this.d(['pull','--platform=linux/amd64',base.reference],{ms:60000,baseReference:base.reference});this.pullCount++;
      verifyBase(json((await this.d(['image','inspect',base.reference])).stdout),base);
    }
    return{verified:true,counts:[this.pullCount],ids:require('./registry-bindings.json').images.map(x=>x.imageId)};
  }
  async builds(){
    const until=clock()+270000,cwd=path.join(this.release,'.github/ssb-capacity-diagnostic');
    for(const app of ['api','dashboard','reporter','widget']){
      const iid=path.join(this.privateRoot,app+'.iid');
      const args=['build','--platform=linux/amd64','--pull=false','--progress=plain','--network=default','--iidfile',iid,'--label',`org.opencontainers.image.revision=${SOURCE}`,'--build-arg',`APP_COMMIT_SHA=${SOURCE}`,'--build-arg',`BUILD_COMMIT=${SOURCE}`,'--build-arg',`BUILD_DATE=${BUILD_DATE}`,'-f',`dockerfiles/${app}.Dockerfile`,['api','dashboard'].includes(app)?`source/apps/${app}`:'source'];
      if(app==='reporter'){require('./reporter-source.cjs').verify(this.reporterSource);args.splice(args.length-3,3,'--label',`com.ssb.reporter-source=${this.reporterSource.hash}`,'-f','reporter.Dockerfile','.');}
      await this.d(args,{cwd:app==='reporter'?this.reporterSource.root:cwd,ms:until-clock()});const id=regular(iid,80).toString().trim();need(/^sha256:[a-f0-9]{64}$/.test(id),'build_id_invalid');
      const list=json((await this.d(['image','inspect',id])).stdout);need(list.length===1&&list[0].Id===id&&list[0].Os==='linux'&&list[0].Architecture==='amd64'&&list[0].Config?.Labels?.['org.opencontainers.image.revision']===SOURCE,'candidate_image_invalid');
      if(app==='reporter')need(list[0].Config.Labels['com.ssb.reporter-source']===this.reporterSource.hash,'reporter_source_changed');
      this.images[app]=id;this.imageMetadata??={};this.imageMetadata[app]=list[0];
    }
    this.images['admin-writer']=this.images.api;
    return{verified:true,counts:[4,2],ids:Object.values(this.images),hashes:[this.reporterSource.hash]};
  }
  async create(name,image,args,role){
    need(!this.initial.containers.includes(name)&&this.owned.length<19&&!this.owned.some(x=>x.name===name),'resource_limit');
    const entry={name,image,role,id:null,startRequested:false};this.owned.push(entry);
    const result=await this.d(['create','--name',name,'--label',`com.ssb.native-run=${this.options.run}`,'--pull=never','--platform=linux/amd64','--restart=no','--security-opt=no-new-privileges:true',...args,image,...(role==='probe'?['node','-e','process.on("SIGTERM",()=>process.exit(0));setInterval(()=>{},1000)']:[])]);
    entry.id=result.stdout.toString().trim();need(fullId(entry.id),'created_id');
    const x=(await this.inspect(entry.id))[0];need(x.Id===entry.id&&x.Image===image&&x.Name==='/'+name&&x.State.Status==='created'&&!x.HostConfig.Privileged&&!Object.keys(x.HostConfig.PortBindings||{}).length&&!x.HostConfig.PublishAllPorts,'created_security');return entry;
  }
  async runningLimit(){const rows=(await this.d(['container','ls','-q','--filter',`label=com.ssb.native-run=${this.options.run}`])).stdout.toString().trim().split('\n').filter(Boolean);need(rows.length<=8,'running_resource_limit');}
  async start(entry){entry.startRequested=true;await this.d(['start',entry.id]);const x=(await this.inspect(entry.id))[0];need(x.State.Status==='running'&&x.State.Running&&!x.State.OOMKilled,'service_not_running');await this.runningLimit();return x;}
  async probe(action,extra={},ms=15000,operation){
    const input={...this.synthetic,action,service:this.prefix,generation:this.current?.generation,source:SOURCE,buildDate:BUILD_DATE,imageId:this.images.api,replayId:this.replayId,...extra};
    const ready=['postgres-ready-init','postgres-ready-restore'].includes(action);
    if(action==='closed-ready'){
      const b=require('./diagnostics.cjs').startProtocol().binding(operation);
      need(b.operation==='closed-ready'&&b.service==='probe'&&b.generation===this.current.generation&&b.run===this.options.run&&b.source===SOURCE&&b.publication===this.verifiedPublicationManifest,'probe_binding_invalid');
    }
    const restore=action==='restore-logins'||action==='database'&&extra.restoreStage!==undefined;
    const diagnostic=action==='initialize'||ready||action==='closed-ready'||restore?{version:1,action,run:this.options.run,source:SOURCE,publication:this.verifiedPublicationManifest,call:operation?.call||sha(randomUUID()),...(action==='closed-ready'?{generation:this.current.generation}:{}),...(action==='database'?{restoreStage:extra.restoreStage}:{})}:undefined;
    if(diagnostic){require('./diagnostics.cjs').validateProbeBinding(diagnostic);input.diagnostic=diagnostic;}
    if(ready){need(Number.isInteger(ms)&&ms>800&&ms<=1500,'readiness_deadline');input.readinessTimeoutMs=ms-400;}
    const result=await this.d(['exec','-i',this.probeContainer.id,'node','/proof/probe.cjs'],{input:JSON.stringify(input),ms,...(diagnostic?{probeDiagnostic:{binding:diagnostic,container:this.probeContainer.id,...(input.snapshotBaseline?{snapshotBaseline:input.snapshotBaseline}:{})}}:{})});const r=proofResult(result.stdout);
    if(diagnostic)need(result.stderr.length===0,'probe_diagnostic_invalid');
    if(action==='database'&&diagnostic)require('./snapshot-diagnostic.cjs').result(r,diagnostic,input.snapshotBaseline);
    if(ready)return require('./postgres-readiness.cjs').validateResult(r,input);
    const expected={initialize:[34,4,1],roles:[32],'closed-ready':[3,2],e1:[11,7],drain:[8,1,7],'restore-logins':[2,2],'retired-admission':[8,1]};
    if(expected[action])need(JSON.stringify(r.counts)===JSON.stringify(expected[action]),'mandatory_proof_missing');
    if(action==='retired-admission')need(r.generation===this.current.generation&&r.retiredGeneration===extra.retiredGeneration&&r.code==='generation_retired','retired_proof_binding');
    if(['database','e1'].includes(action))need(Array.isArray(r.hashes)&&r.hashes.length===(action==='e1'?2:1)&&r.hashes.every(x=>/^[a-f0-9]{64}$/.test(x)),'mandatory_digest_missing');return r;
  }
  async postgresReady(stage){
    const readiness=require('./postgres-readiness.cjs'),binding=readiness.target(stage),action='postgres-ready-'+stage;
    const until=Math.min(clock()+(stage==='init'?6000:5000),this.deadline-30000,this.probeDeadline-30000);let last;
    while(true){
      const remaining=Math.floor(until-clock());
      if(remaining<=800){const error=new GateError('readiness_deadline');if(last)error.cause=last;throw error;}
      try{const result=await this.probe(action,{readiness:binding},Math.min(1500,remaining));need(clock()<=until,'readiness_deadline');return result;}
      catch(error){if(!readiness.retryable(error,action))throw error;last=error;}
      await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(0,until-clock()-800))));
    }
  }
  async state(action,binding,extra={}){
    need(typeof this.stateEntry==='string'&&path.isAbsolute(this.stateEntry),'state_entry_unbound');
    const result=await this.command(process.execPath,stateArgs(this.stateEntry),{input:JSON.stringify({action,binding,toolsRoot:this.toolsRoot,owner:this.synthetic.owner,epoch:this.epoch,...extra}),uid:1000,gid:1000,ms:1000,stateDiagnostic:true});
    need(result.stderr.length===0,'state_diagnostic_invalid');return json(result.stdout);
  }
  async stateLoadCheck(runtime){
    need(typeof this.stateEntry==='string'&&path.isAbsolute(this.stateEntry),'state_entry_unbound');
    const result=await this.command(process.execPath,stateArgs(this.stateEntry,runtime?'load-runtime':'load'),{input:JSON.stringify({toolsRoot:this.toolsRoot}),uid:1000,gid:1000,ms:1000,stateDiagnostic:true});
    need(result.stderr.length===0,'state_diagnostic_invalid');
    const proof=json(result.stdout),expected={loaded:true,uid:1000,gid:1000,node:'v24.17.0',modules:runtime?8:7,runtime};
    need(JSON.stringify(proof)===JSON.stringify(expected),'state_diagnostic_invalid');return proof;
  }
  async initialize(){
    const trace=new InitProgress();
    try{
    trace.enter('probe-window');
    // The 90-second native window includes setup, all cohorts and restore; no hidden reset per cohort.
    this.probeDeadline=clock()+90000;trace.confirm();
    trace.enter('volume-preflight');
    const volumeNames=['postgres','redis'].map(role=>`${this.prefix}-${role}-data`);
    need(Array.isArray(this.initial.volumes)&&volumeNames.every(name=>!this.initial.volumes.includes(name)),'preexisting_volume_forbidden');trace.confirm();
    for(const key of networks){trace.enter('network-create');const name=`${this.prefix}-${key}`;const id=(await this.d(['network','create','--internal','--driver=bridge','--label',`com.ssb.native-run=${this.options.run}`,name])).stdout.toString().trim();need(fullId(id),'network_id');this.networks[key]={name,id,internal:true};trace.confirm();trace.enter('network-inspect');const x=json((await this.d(['network','inspect',id])).stdout)[0];need(x.Id===id&&x.Name===name&&x.Internal===true&&x.Driver==='bridge','internal_network_required');trace.confirm();}
    for(const name of volumeNames){
      trace.enter('volume-list');
      const existing=(await this.d(['volume','ls','-q'])).stdout.toString().trim().split('\n');need(!existing.includes(name),'preexisting_volume_forbidden');trace.confirm();
      trace.enter('volume-create');
      const created=(await this.d(['volume','create','--driver','local','--label',`com.ssb.native-run=${this.options.run}`,name])).stdout.toString().trim();need(created===name,'volume_name_changed');trace.confirm();
      trace.enter('volume-inspect');
      const list=json((await this.d(['volume','inspect',name])).stdout);need(Array.isArray(list)&&list.length===1,'volume_inspect_invalid');const v=list[0];
      need(v.Name===name&&v.Driver==='local'&&v.Scope==='local'&&v.Labels?.['com.ssb.native-run']===this.options.run&&!Object.keys(v.Options||{}).length,'volume_ownership_invalid');this.volumes.push(name);trace.confirm();
    }
    trace.enter('postgres-env-write');
    const bases=require('./registry-bindings.json').images,base=k=>bases.find(x=>x.key===k).imageId;
    const pgEnv=write(path.join(this.privateRoot,'postgres.env'),`POSTGRES_USER=postgres\nPOSTGRES_DB=synthetic\nPOSTGRES_PASSWORD=${this.synthetic.passwords.postgres}\n`);
    trace.confirm();trace.enter('postgres-create');
    this.pg=await this.create(this.prefix+'-postgres',base('postgres'),['--network',this.networks.internal.name,'--network-alias','db','--env-file',pgEnv.path,'--mount',`type=volume,src=${this.volumes[0]},dst=/var/lib/postgresql/data`,'--memory=1g','--pids-limit=128'],'postgres');
    trace.confirm();trace.enter('redis-create');
    this.redis=await this.create(this.prefix+'-redis',base('redis'),['--network',this.networks.internal.name,'--network-alias','redis','--mount',`type=volume,src=${this.volumes[1]},dst=/data`,'--memory=256m','--pids-limit=128'],'redis');
    trace.confirm();trace.enter('probe-create');
    this.probeContainer=await this.create(this.prefix+'-probe',this.images.api,['--network',this.networks.internal.name,'--user=1000:1000','--read-only','--cap-drop=ALL','--tmpfs','/tmp:rw,nosuid,size=64m','--mount',`type=bind,src=${__dirname},dst=/proof,readonly`,'--mount',`type=bind,src=${this.source},dst=/source,readonly`,'--mount',`type=bind,src=${this.stateRoot},dst=/state`,'--memory=1g','--pids-limit=128'],'probe');
    trace.confirm();trace.enter('probe-ingress-connect');
    await this.d(['network','connect',this.networks.ingress.id,this.probeContainer.id]);trace.confirm();trace.enter('probe-writer-connect');await this.d(['network','connect',this.networks.admin_writer.id,this.probeContainer.id]);
    trace.confirm();trace.enter('maintenance-directory');
    const dist=path.join(this.toolsRoot,'apps/api/dist/maintenance');fs.mkdirSync(dist,{recursive:true});trace.confirm();trace.enter('maintenance-copy');await this.d(['cp',`${this.probeContainer.id}:/app/dist/maintenance/maintenance-state.js`,path.join(dist,'maintenance-state.js')]);trace.confirm();trace.enter('maintenance-permissions');fs.chmodSync(path.join(dist,'maintenance-state.js'),0o644);
    trace.confirm();trace.enter('runtime-load');
    await this.stateLoadCheck(true);trace.confirm();trace.enter('state-initialize');
    await this.state('initialize',{root:this.stateRoot,service:this.prefix,generation:'seed'});
    trace.confirm();trace.enter('postgres-start');await this.start(this.pg);trace.confirm();trace.enter('redis-start');await this.start(this.redis);trace.confirm();trace.enter('probe-start');await this.start(this.probeContainer);trace.confirm();
    trace.enter('postgres-ready');
    await this.postgresReady('init');trace.confirm();
    trace.enter('redis-ping');
    need((await this.d(['exec',this.redis.id,'redis-cli','PING'])).stdout.toString().trim()==='PONG','redis_not_ready');trace.confirm();
    trace.enter('redis-version');
    const version=(await this.d(['exec',this.redis.id,'redis-server','--version'])).stdout.toString();need(/v=7\.4\.8\b/.test(version),'redis_version');trace.confirm();
    trace.enter('database-initialize');const result=await this.probe('initialize');trace.confirm();return result;
    }catch(error){throw trace.failure(error);}
  }
  startBinding(operation,service,generation){
    const actions={'activation-helper':'activate-retained-generation','participant-helper':'start-retained-participant','participant-postinspect':'inspect-participant','closure-inspect':'inspect-closure','closure-inventory':'list-closure-name'};
    return require('./diagnostics.cjs').startProtocol().binding({version:1,operation,action:actions[operation]||operation,phase:operation.startsWith('closure-')?'closure':generation+'-start',service,generation,run:this.options.run,source:SOURCE,publication:this.verifiedPublicationManifest,call:sha(randomUUID())});
  }
  async startStep(operation,service,key,fn){
    const binding=this.startBinding(operation,service,key);
    try{return await fn(binding);}catch(error){if(!error.startOperation)error.startOperation=binding;throw error;}
  }
  async privilegedStart(plan,binding,entry){
    const {startProtocol,startArgs}=require('./diagnostics.cjs'),protocol=startProtocol(),helper=path.join(this.toolsRoot,'scripts/ops/maintenance-privileged-executor.cjs');
    const retain=record=>{protocol.validate(record,binding);if(entry&&record.resource.id){need(!entry.id||entry.id===record.resource.id,'started_identity');entry.id=record.resource.id;}if(entry&&protocol.preCreateFailure(record))entry.preCreateFailure=structuredClone(record);};
    try{const result=await this.command(process.execPath,startArgs(helper,plan,binding),{ms:10000,startDiagnostic:{entry:helper,plan,binding}});retain(result.startDiagnostic);return result;}
    catch(error){
      const visit=(e,depth=0)=>{need(depth<8,'start_diagnostic_invalid');if(e?.startDiagnostic)retain(e.startDiagnostic);for(const c of Array.isArray(e?.errors)?e.errors:e?.cause?[e.cause]:[])visit(c,depth+1);};
      try{visit(error);}catch(diagnostic){throw new AggregateError([error,diagnostic],'primary_and_diagnostic_failed');}throw error;
    }
  }
  async startGeneration(key){
    this.current=await this.startStep('generation-prepare','generation',key,()=>generation(this,key,this.previousGeneration,this.previous));
    const planBase={version:1,uid:1000,gid:1000,epoch:this.epoch,ownerSha256:sha(this.synthetic.owner),timeoutMs:10000};
    const activate=await this.startStep('activation-plan','generation',key,()=>write(path.join(this.current.root,'activate.json'),JSON.stringify({...planBase,action:'activate-retained-generation',binding:{...this.current.binding,generation:this.previousGeneration},nextGeneration:key})));
    await this.startStep('activation-helper','generation',key,b=>this.privilegedStart(activate.path,b));
    const policy=await this.startStep('policy-load','generation',key,()=>require(path.join(this.toolsRoot,'scripts/ops/maintenance-start-contract.cjs')));
    for(const service of services){
      const plan=await this.startStep('participant-contract',service,key,()=>{
      need(this.owned.length<19,'resource_limit');const contract={...this.current.common,service,imageId:this.images[service]};policy.assertPlan(this.current.binding,contract);policy.verifyFiles(this.current.binding,contract);
      policy.assertImage([this.imageMetadata[service==='admin-writer'?'api':service]],contract);
      return write(path.join(this.current.root,service+'-start.json'),JSON.stringify({...planBase,action:'start-retained-participant',binding:this.current.binding,contract}));});
      const entry={name:this.current.names[service],image:this.images[service],role:service,generation:key,project:this.current.project,id:null,startRequested:true};this.owned.push(entry);
      try{await this.startStep('participant-helper',service,key,b=>this.privilegedStart(plan.path,b,entry));}
      catch(error){if(service==='reporter')await require('./reporter-diagnostic.cjs').collect(this,error,entry);throw error;}
      const operation=this.startBinding('participant-postinspect',service,key);
      try{const x=(await this.inspect(entry.name,{startOperation:{binding:operation,target:entry.name}}))[0];need(fullId(x.Id)&&x.Id===entry.id&&x.State.Running&&x.Image===entry.image,'started_identity');}
      catch(error){error.startOperation=operation;if(service==='reporter')await require('./reporter-diagnostic.cjs').collect(this,error,entry);throw error;}
      try{await this.startStep('running-limit',service,key,()=>this.runningLimit());
      // Check real mount readability from each application, not only the inspect metadata.
      if(service!=='widget')await this.startStep('mount-readability',service,key,()=>this.d(['exec',entry.id,'node','-e',`const fs=require('fs'),assert=require('assert');assert.equal(process.getuid(),1000);for(const p of ${JSON.stringify(service==='admin-writer'?['/run/ssb-writer-db','/run/ssb-writer-signing-key']:service==='dashboard'?['/run/ssb-writer-signing-key']:[])})assert.ok(fs.readFileSync(p).length);for(const p of ${JSON.stringify(service==='admin-writer'?[]:service==='dashboard'?['/run/ssb-writer-db','/run/ssb-maintenance/runtime-state.json']:['/run/ssb-writer-db','/run/ssb-writer-signing-key'])})assert.throws(()=>fs.readFileSync(p));`]));
      }catch(error){if(service==='reporter')await require('./reporter-diagnostic.cjs').collect(this,error,entry);throw error;}
    }
    try{await this.startStep('reporter-closed-inspect','reporter',key,async()=>{const reporter=this.owned.find(x=>x.generation===key&&x.role==='reporter');need((await this.inspect(reporter.id))[0].State.Running,'reporter_closed_start_failed');});}
    catch(error){await require('./reporter-diagnostic.cjs').collect(this,error,this.owned.find(x=>x.generation===key&&x.role==='reporter'));throw error;}
    try{await this.startStep('closed-ready','probe',key,b=>this.probe('closed-ready',{},15000,b));}
    catch(error){
      const diagnostic=require('./dashboard-diagnostic.cjs');
      try{await diagnostic.collect(this,error);}catch(extra){const found=diagnostic.target(error);if(found){found.primary.startOperation=found.binding;found.primary.dashboardError=diagnostic.code(extra);}}
      throw error;
    }
    await this.startStep('state-snapshot','generation',key,async()=>{const closed=await this.state('snapshot',this.current.binding);need(closed.phase==='closed'&&Object.values(closed.work).every(x=>x.state==='completed'),'closed_start_admitted_work');});
    await this.startStep('state-open','generation',key,()=>this.state('open',this.current.binding));
    const retired=['release','forward','normal'].slice(0,['release','forward','normal'].indexOf(key));
    for(const retiredGeneration of retired)await this.startStep('retired-admission','probe',key,()=>this.probe('retired-admission',{retiredGeneration}));
    return{verified:true,counts:[5,5,retired.length*8],ids:this.owned.filter(x=>x.generation===key).map(x=>x.id)};
  }
  async e1(){const result=await this.probe('e1');const r=this.owned.find(x=>x.generation===this.current.generation&&x.role==='reporter');const x=(await this.inspect(r.id))[0];need(x.State.Status==='exited'&&x.State.ExitCode===0&&!x.State.OOMKilled,'reporter_completion_failed');const state=await this.state('snapshot',this.current.binding);need(Object.values(state.work).some(w=>w.generation===this.current.generation&&w.kind==='worker'&&w.state==='completed'),'reporter_work_missing');
    const widget=this.owned.find(x=>x.generation===this.current.generation&&x.role==='widget');
    const bytes=(await this.d(['exec',widget.id,'sha256sum','/usr/share/nginx/html/widget.js','/usr/share/nginx/html/loader.js'])).stdout.toString().trim().split('\n').map(x=>x.split(/\s+/)[0]);need(JSON.stringify(bytes)===JSON.stringify(result.hashes),'widget_bytes_changed');return result;}
  async drain(){const result=await this.probe('drain');this.epoch=result.epoch;return result;}
  async shutdown(){
    const cohort=this.owned.filter(x=>x.generation===this.current.generation);
    // Parallel bounded stop leaves each app its full seven-second shutdown contract.
    const jobs=cohort.map(entry=>this.d(['stop','--time','8',entry.id],{ms:10000}));const ends=await Promise.allSettled(jobs);need(ends.every(x=>x.status==='fulfilled'),'stop_failed');
    const policy=require(path.join(this.toolsRoot,'scripts/ops/maintenance-start-contract.cjs'));this.previous=[];
    for(const entry of cohort){const list=await this.inspect(entry.id),x=list[0];need(x.State.Status==='exited'&&!x.State.Running&&!x.State.OOMKilled&&!x.State.Error,'exit_unverified');
      const p={service:entry.role,id:entry.id,imageId:entry.image,name:entry.name,project:entry.project};
      if(['api','admin-writer'].includes(entry.role)){const file=path.join(this.stateRoot,`shutdown-${entry.name}.json`);p.receipt={path:file,sha256:sha(regular(file))};}
      policy.assertPredecessor(this.current.binding,{...this.current.common,previousGeneration:this.current.generation},p,list);
      if(entry.role==='reporter')need(x.State.ExitCode===0,'reporter_exit_not_clean');this.previous.push(p);
    }
    const state=await this.state('drained',this.current.binding);need(state.completed===true,'global_drain_missing');
    await this.probe('database',{noPools:true});this.previousGeneration=this.current.generation;
    for(const entry of cohort)if(['api','admin-writer'].includes(entry.role))entry.orderedShutdown=true;
    return{verified:true,counts:[5,2,0],ids:cohort.map(x=>x.id),hashes:this.previous.filter(x=>x.receipt).map(x=>x.receipt.sha256)};
  }
  async restore(){
    const trace=new(require('./restore-diagnostic.cjs').RestoreProgress)({run:this.options.run,source:SOURCE,publication:this.verifiedPublicationManifest});
    const before=await trace.at('database-before',()=>this.probe('database',{noPools:true,restoreStage:'before'}));
    const dump=await trace.at('dump',async()=>(await this.d(['exec',this.pg.id,'pg_dump','-U','postgres','-d','synthetic','--format=custom'],{ms:5000})).stdout);
    const snapshotBaseline=await trace.at('dump-check',()=>{need(dump.length>0&&dump.length<=16*1024*1024,'dump_limit');return require('./snapshot-diagnostic.cjs').bind(before.snapshot,sha(dump));});
    const base=require('./registry-bindings.json').images.find(x=>x.key==='postgres');
    const env=path.join(this.privateRoot,'postgres.env');this.restorePg=await trace.at('postgres-create',()=>this.create(this.prefix+'-restore-postgres',base.imageId,['--network',this.networks.internal.name,'--network-alias','restore-db','--env-file',env,'--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=1g','--memory=1g','--pids-limit=128'],'restore-postgres'));
    await trace.at('postgres-start',()=>this.start(this.restorePg));
    await trace.at('postgres-ready',()=>this.postgresReady('restore'));
    const globals=await trace.at('role-dump',async()=>(await this.d(['exec',this.pg.id,'pg_dumpall','-U','postgres','--roles-only','--no-role-passwords'])).stdout.toString());
    // Existing bootstrap role is the only intentionally omitted role declaration.
    const sql=await trace.at('role-filter',()=>globals.replace(/^CREATE ROLE postgres;\n/m,''));
    await trace.at('role-import',()=>this.d(['exec','-i',this.restorePg.id,'psql','-U','postgres','-d','synthetic','-v','ON_ERROR_STOP=1'],{input:sql}));
    await trace.at('database-import',()=>{need(sha(dump)===snapshotBaseline.archive,'snapshot_binding_invalid');return this.d(['exec','-i',this.restorePg.id,'pg_restore','-U','postgres','-d','synthetic','--exit-on-error'],{input:dump});});
    await trace.at('role-logins',()=>this.probe('restore-logins',{host:'restore-db'}));
    let after;
    try{after=await trace.at('database-after',()=>this.probe('database',{host:'restore-db',expected:before.hashes[0],noPools:true,restoreStage:'after',snapshotBaseline}));}
    catch(error){try{error.restoreSnapshot=require('./snapshot-diagnostic.cjs').baseline(snapshotBaseline);}catch(cause){throw new AggregateError([error,cause],'restore_snapshot_binding_failed');}throw error;}
    return trace.at('result',()=>({verified:true,counts:after.counts,hashes:[sha(dump),...after.hashes],detail:{failure:null,outcomes:[],snapshotBaseline,snapshot:after.snapshotComparison}}));
  }
  async finalInventory(){
    const final=await this.inventory();for(const key of Object.keys(this.initial))need(this.initial[key].every(x=>final[key].includes(x)),'preexisting_resource_changed');
    for(const [key,expected]of Object.entries({containers:this.owned.map(x=>x.id),networks:Object.values(this.networks).map(x=>x.id),volumes:this.volumes}))need(JSON.stringify(final[key].filter(x=>!this.initial[key].includes(x)).sort())===JSON.stringify([...expected].sort()),'unexpected_resource');
    need(this.owned.length===19&&Object.keys(this.networks).length===5&&this.volumes.length===2,'resource_inventory_incomplete');
    for(const item of this.owned){const x=(await this.inspect(item.id))[0];need(x.Image===item.image&&x.Id===item.id&&x.Name==='/'+item.name,'retained_identity_changed');}
    for(const n of Object.values(this.networks)){const x=json((await this.d(['network','inspect',n.id])).stdout)[0];need(x.Internal&&x.Name===n.name,'network_changed');}
    for(const name of this.volumes){const list=json((await this.d(['volume','inspect',name])).stdout);need(list.length===1&&list[0].Name===name&&list[0].Driver==='local'&&list[0].Scope==='local'&&list[0].Labels?.['com.ssb.native-run']===this.options.run&&!Object.keys(list[0].Options||{}).length,'volume_changed');}
    this.final=final;return{verified:true,counts:[19,5,2],ids:[...this.owned.map(x=>x.id),...Object.values(this.networks).map(x=>x.id)]};
  }
  async execute(phase){
    need(!this.resourceFailure,'resource_floor_observed');
    const fixed={preflight:'preflight',bases:'bases',builds:'builds',initialize:'initialize',roles:null,restore:'restore',inventory:'finalInventory'};
    if(phase==='roles')return this.probe('roles');if(fixed[phase])return this[fixed[phase]]();
    const [key,step]=phase.split('-');need(['release','forward','normal'].includes(key),'unknown_phase');
    if(step==='start')return this.startGeneration(key);need(this.current?.generation===key,'cohort_binding_changed');
    if(step==='e1')return this.e1();if(step==='drain')return this.drain();if(step==='shutdown')return this.shutdown();throw Error('unknown stage');
  }
  async recordFailure(error){
    const root=this.privateRoot?path.join(this.privateRoot,'raw'):fs.mkdtempSync(path.join(os.tmpdir(),'ssb-native-failure-'));
    const record={run:/^\d+$/.test(this.options.run||'')?this.options.run:null,source:SOURCE,utc:new Date().toISOString(),failure:failureRecord(error)};
    const bytes=JSON.stringify(record,null,2)+'\n';need(Buffer.byteLength(bytes)<=32768,'private_diagnostic_limit');
    fs.writeFileSync(path.join(root,'failure.json'),bytes,{flag:'wx',mode:0o600});
  }
  async close(failed){
    clearInterval(this.watch);if(!this.proc)return{verified:true,counts:[0]};
    let errors=[];const outcomes=this.owned.map(entry=>({id:entry.id,role:entry.role,generation:entry.generation||'seed',state:'unverified',exit:null,code:'unclassified',observation:{before:null,stop:{requested:false,completed:false},after:null}}));const closureStart=clock();this.closureDeadline=Math.min(this.deadline,this.probeDeadline||Infinity,closureStart+30000);
    await Promise.all(this.owned.map(async(entry,index)=>{const outcome=outcomes[index];try{
      if(entry.id===null&&entry.preCreateFailure){
        const protocol=require('./diagnostics.cjs').startProtocol(),record=entry.preCreateFailure,b=record.binding;
        need(failed&&protocol.preCreateFailure(record)&&b.run===this.options.run&&b.source===SOURCE&&b.publication===this.verifiedPublicationManifest
          &&b.service===entry.role&&b.generation===entry.generation&&entry.name===`ssb-native-${b.run}-${b.generation}-${b.service}`,'cleanup_identity_unverified');
        const operation=this.startBinding('closure-inventory',entry.role,entry.generation);
        try{
          const result=await this.d(['container','ls','--all','--no-trunc','--filter',`name=^/${entry.name}$`,'--format','{{.ID}}'],{closure:true,ms:1500,startOperation:{binding:operation,target:entry.name}});
          need(result.stdout.length===0&&result.stderr.length===0,'cleanup_identity_unverified');
        }catch(error){error.startOperation=operation;throw error;}
        Object.assign(outcome,{state:'not_created',code:'none'});return;
      }
      const identity=list=>{need(Array.isArray(list)&&list.length===1,'cleanup_identity_unverified');const x=list[0];need(x.Name==='/'+entry.name&&x.Image===entry.image&&fullId(x.Id),'cleanup_identity_unverified');
        need(!(this.initial?.containers||[]).includes(x.Id),'cleanup_preexisting_forbidden');
        const labels=x.Config?.Labels||{},ownedLabel=labels['com.ssb.native-run']===this.options.run;
        const ownedProject=typeof entry.project==='string'&&entry.project.length>0&&labels['com.docker.compose.project']===entry.project&&labels['com.docker.compose.service']===entry.role;
        need(ownedLabel&&(!entry.project||ownedProject)&&(!entry.id||entry.id===x.Id),'cleanup_ownership');entry.id=x.Id;outcome.id=x.Id;return x;};
      const neverStarted=x=>entry.startRequested===false&&x.RestartCount===0&&x.State?.Status==='created'&&x.State.Running===false&&x.State.Paused===false&&x.State.Restarting===false&&x.State.Dead===false&&x.State.OOMKilled===false&&x.State.Error===''&&x.State.Pid===0&&x.State.ExitCode===0&&x.State.StartedAt==='0001-01-01T00:00:00Z'&&x.State.FinishedAt==='0001-01-01T00:00:00Z';
      const inspect=async target=>{
        const operation=this.verifiedPublicationManifest?this.startBinding('closure-inspect',entry.role,entry.generation||'seed'):undefined;
        try{return identity(json((await this.d(['container','inspect',target],{closure:true,ms:1500,...(operation?{startOperation:{binding:operation,target}}:{})})).stdout));}
        catch(error){if(operation)error.startOperation=operation;throw error;}
      };
      const x=await inspect(entry.id||entry.name);
      outcome.observation.before=require('./diagnostics.cjs').closureSnapshot(x);
      if(x.State.Running){
        const stop=()=>this.d(['stop','--time','8',entry.id],{closure:true,ms:9500});
        outcome.observation.stop.requested=true;
        // Like closure inspect, early cleanup must not depend on a completed publication preflight.
        if(this.verifiedPublicationManifest)await this.startStep('closure-stop',entry.role,entry.generation||'seed',stop);else await stop();
        outcome.observation.stop.completed=true;
      }
      const end=await inspect(entry.id);
      outcome.observation.after=require('./diagnostics.cjs').closureSnapshot(end);
      if(neverStarted(x)&&neverStarted(end)){need(failed,'never_started_on_success');Object.assign(outcome,{state:'never_started',code:'none'});return;}
      need(end.State.Running===false&&end.State.Status==='exited'&&!end.State.OOMKilled&&!end.State.Error&&!end.State.Paused&&!end.State.Restarting&&!end.State.Dead&&Number.isInteger(end.State.ExitCode)&&end.State.ExitCode>=0&&end.State.ExitCode<=255,'container_completion_unverified');
      Object.assign(outcome,{state:end.State.ExitCode===0?'exited':'exited_unclean',exit:end.State.ExitCode,code:end.State.ExitCode===0?'none':'forced_or_nonzero'});
      if(!failed&&['postgres','restore-postgres','redis','probe'].includes(entry.role))need(end.State.ExitCode===0,'infrastructure_shutdown_failed');
      if(!failed&&['postgres','restore-postgres'].includes(entry.role)){const logs=(await this.d(['logs','--tail','30',entry.id],{closure:true,ms:1500}));need(Buffer.concat([logs.stdout,logs.stderr]).toString().includes('database system is shut down'),'postgres_clean_shutdown_missing');}
      if(entry.orderedShutdown===true){need(end.State.ExitCode===0,'container_completion_unverified');outcome.state='graceful';}
    }catch(e){outcome.state='unverified';outcome.code=publicFailure(e).code;errors.push(e);}}));
    const publicReceipt={counts:[this.owned.length,this.owned.filter(x=>x.id).length,this.proc.calls.length],ids:[...this.owned.filter(x=>x.id).map(x=>x.id),...Object.values(this.networks).map(x=>x.id)],detail:{failure:null,outcomes}};
    errors.push(...(this.diagnosticFailures||[]));
    try{this.proc.assertClosed();need(clock()<=this.closureDeadline,'overall_deadline');}catch(e){errors.push(e);}
    if(errors.length){const error=new AggregateError(errors,'closure_incomplete');error.publicReceipt=publicReceipt;throw error;}this.closed=true;
    return{verified:true,...publicReceipt};
  }
}
module.exports={Native,verifyBase,proofResult};
