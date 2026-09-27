const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assertSitePilotAccess, readSitePilotAccessRules } = require('../dist/utils/site-pilot-access.js');
const { EvaluationService } = require('../dist/evaluation/evaluation.service.js');

const token = randomBytes(32).toString('hex');
const scope = { tenantId: 'synthetic-tenant', siteId: 'synthetic-site' };
const start = Date.parse('2026-01-01T00:00:00.000Z');
const rule = { ...scope,
  tokenSha256: createHash('sha256').update(`${scope.tenantId}\0${scope.siteId}\0${token}`).digest('hex'),
  validFrom: new Date(start).toISOString(), expiresAt: new Date(start + 3600000).toISOString() };
const req = { headers: { 'x-site-pilot-token': token } };
const status = (expected) => (error) => error.getStatus?.() === expected;
function configure(t, rules) {
  const before = process.env.SITE_PILOT_ACCESS_RULES_JSON;
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify(rules);
  t.after(() => { if (before === undefined) delete process.env.SITE_PILOT_ACCESS_RULES_JSON;
    else process.env.SITE_PILOT_ACCESS_RULES_JSON = before; });
}

test('unset restriction leaves existing sites unchanged; invalid settings never become an empty allowlist', (t) => {
  configure(t, []);
  assert.doesNotThrow(() => assertSitePilotAccess(scope));
  assert.deepEqual(readSitePilotAccessRules(''), []);
  for (const raw of [' ', '{', 'null', '{}', 'false', 'x'.repeat(32769)]) {
    assert.throws(() => readSitePilotAccessRules(raw), status(503));
  }
});

test('rejects ambiguous scopes, duplicate sites, malformed digests and invalid time windows', () => {
  for (const bad of [
    null, [], { ...rule, siteId: '*' }, { ...rule, tenantId: '' }, { ...rule, siteId: ' synthetic-site' },
    { ...rule, tokenSha256: 'not-a-digest' }, { ...rule, extra: true },
    { ...rule, validFrom: '2026-01-01' }, { ...rule, validFrom: '2026-02-30T00:00:00.000Z' },
    { ...rule, expiresAt: rule.validFrom }, { ...rule, expiresAt: '2026-01-01T01:00:00.001Z' },
  ]) assert.throws(() => readSitePilotAccessRules(JSON.stringify([bad])), status(503));
  assert.throws(() => readSitePilotAccessRules(JSON.stringify([rule, rule])), status(503));
});

test('allows the exact token only within the window; expiry keeps the restricted site closed', (t) => {
  configure(t, [rule]);
  for (const now of [start, start + 3599999]) assert.doesNotThrow(() => assertSitePilotAccess(scope, req, now));
  for (const now of [start - 1, start + 3600000, start + 86400000, NaN]) {
    assert.throws(() => assertSitePilotAccess(scope, req, now), status(403));
  }
});

test('missing, wrong, duplicate and spoofed credentials cannot reach a restricted site', (t) => {
  configure(t, [rule]);
  for (const request of [undefined, { headers: {} }, { headers: { 'x-site-pilot-token': '0'.repeat(64) } },
    { headers: { 'x-site-pilot-token': [token, token] } }, { headers: { 'x-site-pilot-token': `${token}, ${token}` } },
    { headers: { 'x-site-pilot-token': ` ${token}` } },
    { headers: { 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1', 'x-tenant-id': 'other',
      'x-site-key': 'other', authorization: `Bearer ${token}`, cookie: 'ssb_admin=synthetic' } },
  ]) assert.throws(() => assertSitePilotAccess(scope, request, start), status(403));
});

test('server-resolved scope, two unrelated sites and scope-bound digests remain isolated', (t) => {
  const copied = { ...rule, siteId: 'other-protected-site' };
  configure(t, [rule, copied]);
  assert.throws(() => assertSitePilotAccess({ ...scope, tenantId: 'other-tenant' }, req, start), status(403));
  assert.throws(() => assertSitePilotAccess({ ...scope, siteId: copied.siteId }, req, start), status(403));
  assert.doesNotThrow(() => assertSitePilotAccess({ ...scope, siteId: 'public-sibling' }));
  assert.doesNotThrow(() => assertSitePilotAccess({ tenantId: 'other-tenant', siteId: 'public-other-tenant' }));
});

test('rotation rejects the previous token immediately on subsequent requests without revealing either token', (t) => {
  const replacement = randomBytes(32).toString('hex');
  configure(t, [{ ...rule, tokenSha256: createHash('sha256')
    .update(`${scope.tenantId}\0${scope.siteId}\0${replacement}`).digest('hex') }]);
  assert.throws(() => assertSitePilotAccess(scope, req, start), (error) => {
    assert.equal(error.getStatus(), 403);
    assert.equal(JSON.stringify(error.getResponse()).includes(token), false);
    assert.equal(JSON.stringify(error.getResponse()).includes(replacement), false);
    return true;
  });
  assert.doesNotThrow(() => assertSitePilotAccess(scope, { headers: { 'x-site-pilot-token': replacement } }, start));
});

test('evaluation viewer sessions and messages cannot bypass the site restriction', async (t) => {
  configure(t, [rule]);
  const unexpected = () => { throw new Error('Must deny before any evaluation dependency'); };
  const service = new EvaluationService({ query: unexpected }, { process: unexpected },
    { allow: unexpected }, { record: unexpected });
  await assert.rejects(service.createChatSession(scope, {}), status(403));
  await assert.rejects(service.sendMessage(scope, { conversationId: 'existing', message: 'Synthetic' }), status(403));
});

test('actual API bootstrap rejects malformed restriction before listening and hides config contents', () => {
  const marker = 'private-invalid-pilot-config';
  const result = spawnSync(process.execPath, [path.join(__dirname, '../dist/main.js')], {
    encoding: 'utf8', timeout: 10000, env: { ...process.env, SITE_PILOT_ACCESS_RULES_JSON: marker },
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid site pilot access configuration/);
  assert.equal((result.stdout + result.stderr).includes(marker), false);
});
