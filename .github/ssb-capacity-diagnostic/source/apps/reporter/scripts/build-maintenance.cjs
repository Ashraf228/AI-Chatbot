const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Build the SAME protocol implementation, not a second reporter-only lock.
const source = path.resolve(__dirname, '../../api/src/maintenance/maintenance-state.ts');
const output = path.resolve(__dirname, '../dist/maintenance-state.cjs');
const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
});
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, result.outputText);
