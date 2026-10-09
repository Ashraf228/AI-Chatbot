const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { beginKnowledgePilotTrace } = require('../dist/ai/chat-pipeline/knowledge-pilot-trace');
const logger = require('../dist/utils/logger');
const store = require('../dist/ai/chat-pipeline/knowledge-pilot-trace-store');

const scope = { tenantId: 'synthetic-tenant', siteId: 'synthetic-site', conversationId: 'synthetic-conversation',
  sessionId: 'synthetic-session', mode: 'normal' };
const now = Date.parse('2026-01-01T00:30:00.000Z');
const rule = { tenantId: scope.tenantId, siteId: scope.siteId, tokenSha256: 'a'.repeat(64),
  validFrom: '2026-01-01T00:00:00.000Z', expiresAt: '2026-01-01T01:00:00.000Z', traceKnowledgeSelection: true };
const hit = { id: 'chunk-1', document_id: 'document-1', source_id: 'source-1', content: 'PRIVATE_DOCUMENT_TEXT',
  title: 'PRIVATE_TITLE', source_label: 'PRIVATE_LABEL', source_url: 'https://private.invalid/',
  source_type: 'manual', score: 0.75, metadata: { contentHash: 'UNTRUSTED_INGESTION_HASH', secret: 'PRIVATE_METADATA' } };
const hash = (text) => createHash('sha256').update(text).digest('hex');

function setup(t, rules = [rule]) {
  const before = process.env.SITE_PILOT_ACCESS_RULES_JSON;
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify(rules);
  t.after(() => { if (before === undefined) delete process.env.SITE_PILOT_ACCESS_RULES_JSON;
    else process.env.SITE_PILOT_ACCESS_RULES_JSON = before; });
  t.mock.method(Date, 'now', () => now);
  const events = [];
  const sharedLog = t.mock.method(logger, 'logEvent', () => {});
  t.after(() => assert.equal(sharedLog.mock.callCount(), 0, 'Selection trace must never reach shared logs'));
  t.mock.method(store, 'createKnowledgePilotTraceSink', () => ({
    write(data) { events.push({ type: 'knowledge_pilot_selection', data }); return true; },
  }));
  return events;
}

test('trace defaults off, requires exact tenant/site opt-in, and respects both time boundaries', (t) => {
  const events = setup(t);
  const { traceKnowledgeSelection, ...oldRule } = rule;
  for (const rules of [[], [oldRule], [{ ...rule, traceKnowledgeSelection: false }],
    [{ ...rule, tenantId: 'other-tenant' }], [{ ...rule, siteId: 'other-site' }],
    [{ ...rule, validFrom: '2026-01-01T00:30:00.001Z' }],
    [{ ...rule, expiresAt: '2026-01-01T00:30:00.000Z' }],
    [oldRule, { ...rule, siteId: 'other-site' }]]) {
    process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify(rules);
    assert.equal(beginKnowledgePilotTrace(scope, [hit], [hit]), undefined);
  }
  for (const raw of ['{PRIVATE_INVALID_CONFIG', '', undefined]) {
    if (raw === undefined) delete process.env.SITE_PILOT_ACCESS_RULES_JSON;
    else process.env.SITE_PILOT_ACCESS_RULES_JSON = raw;
    assert.equal(beginKnowledgePilotTrace(scope, [hit], [hit]), undefined);
  }
  assert.deepEqual(events, []);
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([rule]);
  t.mock.method(Date, 'now', () => Date.parse(rule.validFrom));
  assert.ok(beginKnowledgePilotTrace(scope, [hit], [hit]));
});

test('ordered hashes bind actual generation text and public references to selected references', (t) => {
  const events = setup(t);
  const second = { ...hit, id: 'chunk-2', content: 'SECOND_PRIVATE_TEXT' };
  const trace = beginKnowledgePilotTrace(scope, [second, hit], [hit, second]);
  trace.validated([second], true);
  const [prepared, validated] = events.map(({ data }) => data);
  assert.equal(prepared.phase, 'prepared');
  assert.deepEqual(prepared.candidates.map(({ rank, chunkId }) => [rank, chunkId]), [[1, 'chunk-2'], [2, 'chunk-1']]);
  assert.deepEqual(prepared.selected.map(({ generationReference, contentSha256 }) => [generationReference, contentSha256]),
    [['Q1', hash(hit.content)], ['Q2', hash(second.content)]]);
  assert.equal(validated.phase, 'validated');
  assert.equal(validated.traceId, prepared.traceId);
  assert.equal(validated.citationsValid, true);
  assert.deepEqual(validated.cited, [{ publicReference: 'Q1', generationReference: 'Q2', chunkId: 'chunk-2', contentSha256: hash(second.content) }]);
  assert.deepEqual([prepared.candidateCount, prepared.selectedCount, prepared.candidatesTruncated, prepared.selectedTruncated], [2, 2, false, false]);
  assert.equal(prepared.sessionId, scope.sessionId);
  assert.equal(events.every(({ type }) => type === 'knowledge_pilot_selection'), true);
  const serialized = JSON.stringify(events);
  for (const value of [hit.content, second.content, hit.title, hit.source_label, hit.source_url,
    hit.metadata.contentHash, hit.metadata.secret, rule.tokenSha256, rule.validFrom, rule.expiresAt]) {
    assert.equal(serialized.includes(value), false, 'Trace must use only its explicit metadata allowlist');
  }
});

test('bounded metadata marks truncation and never logs unsafe identifiers or nonfinite scores', (t) => {
  const events = setup(t);
  const candidates = Array.from({ length: 19 }, (_, i) => ({ ...hit, id: `chunk-${i}` }));
  candidates[0] = { ...hit, id: 'private\nidentifier', document_id: 'x'.repeat(129), source_id: 'private@example.invalid', score: Infinity };
  const trace = beginKnowledgePilotTrace({ ...scope, conversationId: 'private\nid', sessionId: 'private@example.invalid' }, candidates, candidates.slice(0, 10));
  trace.validated(candidates.slice(0, 10), true);
  const [prepared, validated] = events.map(({ data }) => data);
  assert.deepEqual([prepared.candidates.length, prepared.selected.length, prepared.candidateCount, prepared.selectedCount], [16, 8, 19, 10]);
  assert.equal(prepared.candidatesTruncated, true);
  assert.equal(prepared.selectedTruncated, true);
  assert.equal(prepared.conversationId, null);
  assert.equal(prepared.sessionId, null);
  assert.deepEqual([prepared.candidates[0].chunkId, prepared.candidates[0].documentId, prepared.candidates[0].sourceId, prepared.candidates[0].score], [null, null, null, null]);
  assert.equal(validated.cited.length, 8);
  assert.equal(validated.citedCount, 10);
  assert.equal(validated.citedTruncated, true);
  assert.equal(JSON.stringify(events).includes('private'), false);
});

for (const change of ['removed', 'disabled', 'rotated', 'window', 'expired', 'malformed']) {
  test(`trace stops after rule is ${change} during generation`, (t) => {
    const events = setup(t);
    const trace = beginKnowledgePilotTrace(scope, [hit], [hit]);
    if (change === 'removed') process.env.SITE_PILOT_ACCESS_RULES_JSON = '[]';
    if (change === 'disabled') process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([{ ...rule, traceKnowledgeSelection: false }]);
    if (change === 'rotated') process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([{ ...rule, tokenSha256: 'b'.repeat(64) }]);
    if (change === 'window') process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([{ ...rule, expiresAt: '2026-01-01T00:59:00.000Z' }]);
    if (change === 'expired') t.mock.method(Date, 'now', () => Date.parse(rule.expiresAt));
    if (change === 'malformed') process.env.SITE_PILOT_ACCESS_RULES_JSON = '{';
    trace.validated([hit], true);
    trace.generationFailed();
    assert.equal(events.length, 1);
  });
}

test('empty evidence and invalid citations are distinguished from successful generation', (t) => {
  const events = setup(t);
  assert.equal(beginKnowledgePilotTrace(scope, [hit], []), undefined);
  const trace = beginKnowledgePilotTrace(scope, [hit], [hit]);
  trace.validated([], false);
  assert.deepEqual(events.map(({ data }) => data.phase), ['no_evidence', 'prepared', 'validated']);
  assert.equal(events[2].data.citationsValid, false);
  assert.deepEqual(events[2].data.cited, []);
});

test('attempt IDs disambiguate concurrent requests even in the same session', (t) => {
  const events = setup(t);
  const one = beginKnowledgePilotTrace(scope, [hit], [hit]);
  const two = beginKnowledgePilotTrace(scope, [hit], [hit]);
  two.validated([hit], true);
  one.generationFailed();
  const ids = events.map(({ data }) => data.traceId);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(ids[1], ids[2]);
  assert.equal(ids[0], ids[3]);
});

test('diagnostic sink failure never escapes into the chat path or shared logs', (t) => {
  setup(t);
  const trace = beginKnowledgePilotTrace(scope, [hit], [hit]);
  t.mock.method(store.createKnowledgePilotTraceSink.mock.calls[0].result, 'write', () => { throw new Error('PRIVATE_STORE_ERROR'); });
  t.mock.method(store, 'createKnowledgePilotTraceSink', () => { throw new Error('PRIVATE_STORE_ERROR'); });
  assert.doesNotThrow(() => trace.validated([hit], true));
  assert.doesNotThrow(() => trace.generationFailed());
  assert.equal(beginKnowledgePilotTrace(scope, [hit], [hit]), undefined);
});
