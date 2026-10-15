'use strict';
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
for(const name of ['maintenance-state','maintenance-mutex']){
 const input=fs.readFileSync(path.join(__dirname,name+'.ts'),'utf8');
 const result=ts.transpileModule(input,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 if(result.diagnostics?.length)throw Error('maintenance_state_compile_failed');
 let text=result.outputText;
 if(name==='maintenance-state'){
  const from='require("./maintenance-mutex")';if(text.split(from).length!==2)throw Error('maintenance_import_binding');
  text=text.replace(from,'require("./maintenance-mutex.cjs")');
 }
 fs.writeFileSync(path.join(__dirname,name+'.cjs'),text,{flag:'wx',mode:0o644});
}
