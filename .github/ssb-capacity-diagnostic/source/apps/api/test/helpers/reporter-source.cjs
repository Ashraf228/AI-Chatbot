// Current source in memory; no emitted build and no replacement of admission/lifecycle logic.
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
function sourceLoader(root, stubs = {}) {
  const cache = new Map();
  function load(relative) {
    const file = path.resolve(root, relative);
    if (cache.has(file)) return cache.get(file).exports;
    const m = { exports: {} }; cache.set(file, m);
    const requireSource = id => {
      if (Object.hasOwn(stubs, id)) return stubs[id];
      if (id === 'node:module') return { createRequire: () => name => {
        if (name !== '../dist/maintenance-state.cjs') throw Error('unexpected compiled dependency');
        return load('apps/api/src/maintenance/maintenance-state.ts');
      } };
      if (id.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), id.replace(/\.js$/, '.ts'))));
      if (id.startsWith('node:')) return require(id);
      throw Error('uncontrolled dependency: ' + id);
    };
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.url', JSON.stringify('file://' + file));
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true, experimentalDecorators: true } }).outputText;
    new Function('require', 'module', 'exports', code)(requireSource, m, m.exports);
    return m.exports;
  }
  return load;
}
module.exports = { sourceLoader };
