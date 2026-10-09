const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Only synthetic, newly created test services. Never use this to bootstrap an existing runtime.
module.exports = function maintenanceFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-fixture-'));
  fs.chmodSync(root, 0o700);
  const values = { MAINTENANCE_STATE_ROOT: root, MAINTENANCE_SERVICE: 'test-api', MAINTENANCE_GENERATION: 'test-generation' };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  fs.writeFileSync(path.join(root, 'runtime-state.json'), JSON.stringify({ version: 1, service: 'test-api',
    generations: ['test-generation'], epoch: 0, phase: 'open', legacy: 'new-empty-service', work: {} }), { mode: 0o600 });
  Object.assign(process.env, values);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true });
  });
};
