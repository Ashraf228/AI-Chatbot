// In-memory test compilation only: never emit into a reused dist or node_modules.
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path');
const ts=require('typescript');
const api=path.resolve(__dirname,'../..'),dist=fs.realpathSync(path.join(api,'dist'));
const changed=new Set(['admin-writer/database-identity','admin-writer/server','admin-writer/operator','admin-writer/private-file',
  'db/database.service','db/prisma.service','maintenance/maintenance-state','maintenance/maintenance-runtime',
  'maintenance/graceful-shutdown','utils/rate-limit.service']);
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){
  let result;
  try { result=resolve.call(this,request,parent,...rest); }
  catch(error) {
    const candidate=path.resolve(parent?path.dirname(parent.filename):process.cwd(),request);
    const relative=candidate.startsWith(path.join(api,'dist')+path.sep)?path.relative(path.join(api,'dist'),candidate)
      :candidate.startsWith(dist+path.sep)?path.relative(dist,candidate):null;
    const source=relative&&path.join(api,'src',relative.replace(/\.js$/,'')+'.ts');
    if(source&&fs.existsSync(source))return source;
    throw error;
  }
  if(typeof result==='string'&&result.startsWith(dist+path.sep)&&result.endsWith('.js')){
    const source=path.join(api,'src',path.relative(dist,result).replace(/\.js$/,'.ts'));
    if(changed.has(path.relative(dist,result).replace(/\.js$/,''))&&fs.existsSync(source))return source;
  }
  if(typeof result==='string'&&result.startsWith(path.join(api,'src')+path.sep)&&result.endsWith('.ts')){
    const relative=path.relative(path.join(api,'src'),result).replace(/\.ts$/,'');
    const compiled=path.join(dist,relative+'.js');
    if(!changed.has(relative)&&fs.existsSync(compiled))return compiled;
  }
  return result;
};
Module._extensions['.ts']=function(module,file){
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,
    emitDecoratorMetadata:true,esModuleInterop:true}}).outputText;
  module._compile(code,file);
};
