'use strict';
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const input=fs.readFileSync(path.join(__dirname,'maintenance-state.ts'),'utf8');
const result=ts.transpileModule(input,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
if(result.diagnostics?.length)throw Error('maintenance_state_compile_failed');
fs.writeFileSync(path.join(__dirname,'maintenance-state.cjs'),result.outputText,{flag:'wx',mode:0o644});
