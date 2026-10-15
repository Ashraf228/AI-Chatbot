'use strict';
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=path.resolve(__dirname,'../../api/src/maintenance'),output=path.resolve(__dirname,'../dist');
fs.mkdirSync(output,{recursive:true});
for(const name of ['maintenance-state','maintenance-mutex']){
 const result=ts.transpileModule(fs.readFileSync(path.join(source,name+'.ts'),'utf8'),{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}});
 if(result.diagnostics?.length)throw Error('maintenance_compile_failed');
 let text=result.outputText;
 if(name==='maintenance-state'){
  const from='require("./maintenance-mutex")';
  if(text.split(from).length!==2)throw Error('maintenance_import_binding');
  // The reporter package is ESM; both runtime modules must explicitly be CJS.
  text=text.replace(from,'require("./maintenance-mutex.cjs")');
 }
 fs.writeFileSync(path.join(output,name+'.cjs'),text,{flag:'wx',mode:0o644});
}
