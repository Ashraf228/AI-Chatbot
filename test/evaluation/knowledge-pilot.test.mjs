import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CATEGORY_COUNTS, DIMENSIONS, assess, capture, digest, main, readReply, reviewTemplate, validateDataset } from '../../scripts/evaluation/knowledge-pilot.mjs';

const corpus = Buffer.from('Synthetisches Handbuch: Sicherung täglich.');
const target = { apiOrigin: 'https://api.synthetic.invalid', widgetOrigin: 'https://widget.synthetic.invalid', siteKey: 'synthetic', releaseSha: 'a'.repeat(40) };
function dataset() {
  const cases = Object.entries(CATEGORY_COUNTS).flatMap(([category, count]) => Array.from({ length: count }, () => ({ category })));
  return { schemaVersion: 1, suite: 'knowledge-pilot-40', corpus: { filename: 'synthetic.txt', sha256: digest(corpus) },
    cases: cases.map((item, index) => ({ ...item, id: `P${String(index + 1).padStart(2, '0')}`,
      turns: item.category === 'followup' ? ['Wie läuft die Sicherung?', 'Wie oft?'] : ['Wie oft läuft die Sicherung?'],
      expected: { criterion: 'Nur belegte Aussagen', facts: ['täglich'], references: [{ sourceTitle: 'Handbuch', locator: 'Absatz 1', quote: 'Sicherung täglich' }],
        corpusReview: 'verified', reviewNote: 'Synthetic fixture; no live evidence', absenceCheck: 'Synthetic absence fixture', forbiddenClaims: [] } })),
  };
}
function options(overrides = {}) { return { dataset: dataset(), corpusBytes: corpus, target, execute: true, ...overrides }; }
function fakeTransport({ answer = 'Täglich. [Q1]', brokenStream = false, failChat = false } = {}) {
  let sessions = 0;
  const calls = [];
  return { calls, fetchImpl: async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, init, body });
    if (url.endsWith('/session')) return Response.json({ id: `session-${++sessions}` });
    if (failChat) throw new Error('private upstream detail');
    const reply = { sessionId: body.sessionId, answer, sources: [{ title: 'Handbuch', excerpt: 'Sicherung täglich.', metadata: { private: 'not for capture' } }] };
    if (url.endsWith('/stream')) return new Response([
      { type: 'start', sessionId: body.sessionId }, { type: 'chunk', delta: brokenStream ? 'UNVERIFIED TEXT' : answer },
      { type: 'done', ...reply },
    ].map(JSON.stringify).join('\n'));
    return Response.json(reply);
  } };
}
async function fullFixture() {
  const source = dataset();
  const run = await capture(options({ dataset: source, maxChatRequests: 120 }), fakeTransport());
  const review = reviewTemplate([run]);
  review.reviewer = 'Synthetic test reviewer'; review.reviewedAt = '2026-01-01'; review.runtimeEvidence = 'Synthetic test fixture, not a live result';
  for (const entry of review.runs[0].cases) for (const turn of entry.turns) {
    for (const dimension of DIMENSIONS) turn[dimension] = 'pass'; turn.notes = 'Synthetic source assessment';
  }
  return { source, run, review };
}

test('dataset enforces all 40 cases and the agreed category distribution', () => {
  const source = dataset(); assert.equal(validateDataset(source).ready, true);
  source.cases.pop(); assert.throws(() => validateDataset(source), /40/);
});
test('case identity, follow-up context and references cannot be silently dropped', () => {
  for (const mutate of [
    (d) => { d.cases[1].id = d.cases[0].id; },
    (d) => { d.cases[26].turns = ['Ohne Kontext']; },
    (d) => { d.cases[0].expected.references[0].quote = ''; },
    (d) => { d.cases[32].expected.absenceCheck = ''; },
  ]) { const d = dataset(); mutate(d); assert.throws(() => validateDataset(d)); }
});
test('pending grounding, missing opt-in and a different corpus prevent every network call', async () => {
  const d = dataset(); d.cases[0].expected.corpusReview = 'pending';
  assert.equal(validateDataset(d).ready, false);
  for (const override of [{ dataset: d }, { execute: false }, { corpusBytes: Buffer.from('different') }]) {
    const transport = fakeTransport(); await assert.rejects(capture(options(override), transport)); assert.equal(transport.calls.length, 0);
  }
});
test('rejects credential-bearing URLs, remote plain HTTP and invalid budgets before transport', async () => {
  for (const override of [
    { target: { ...target, apiOrigin: 'https://user:secret@api.synthetic.invalid' } },
    { target: { ...target, widgetOrigin: 'http://widget.synthetic.invalid' } },
    { target: { ...target, apiOrigin: 'https://api.synthetic.invalid?token=private' } },
    { target: { ...target, releaseSha: 'latest' } }, { maxChatRequests: 0 }, { maxChatRequests: 121 },
  ]) { const t = fakeTransport(); await assert.rejects(capture(options(override), t)); assert.equal(t.calls.length, 0); }
});
test('captures both public paths with fresh sessions and preserves reviewable excerpts only', async () => {
  const t = fakeTransport(); const snapshots = [];
  const run = await capture(options({ caseIds: ['P01'] }), { ...t, checkpoint: async (r) => snapshots.push(JSON.stringify(r)) });
  assert.equal(run.chatRequests, 2); assert.equal(run.stopReason, null); assert.equal(run.cases.length, 2);
  assert.notEqual(run.cases[0].sessionId, run.cases[1].sessionId);
  assert.equal(run.cases[0].status, 'captured_pending_review');
  assert.deepEqual(run.cases[0].turns[0].sources, [{ title: 'Handbuch', excerpt: 'Sicherung täglich.' }]);
  assert.equal(run.usage.tokens, null); assert.equal(run.usage.cost, null); assert.ok(snapshots.length >= 4);
  assert.ok(t.calls.every((call) => call.init.redirect === 'error' && call.init.signal && call.init.headers.Origin === target.widgetOrigin));
});
test('multi-turn cases use actual preceding replies in one session; cases and modes are isolated', async () => {
  const t = fakeTransport(); const run = await capture(options({ caseIds: ['P27'], maxChatRequests: 4 }), t);
  const messages = t.calls.filter((entry) => !entry.url.endsWith('/session'));
  assert.equal(messages.length, 4); assert.equal(messages[0].body.sessionId, messages[1].body.sessionId);
  assert.notEqual(messages[1].body.sessionId, messages[2].body.sessionId);
  assert.deepEqual(run.cases.map((entry) => entry.turns.map((turn) => turn.question)), [dataset().cases[26].turns, dataset().cases[26].turns]);
});
test('request budget does not start a session for a turn sequence it cannot finish', async () => {
  const t = fakeTransport(); const run = await capture(options({ caseIds: ['P27'], maxChatRequests: 1 }), t);
  assert.equal(t.calls.length, 0); assert.equal(run.chatRequests, 0); assert.equal(run.stopReason, 'chat_request_limit');
});
test('default request budget is six total messages across modes, including context turns', async () => {
  const run = await capture(options(), fakeTransport()); assert.equal(run.chatRequests, 6); assert.equal(run.cases.length, 6);
  assert.equal(run.stopReason, 'chat_request_limit');
});
test('runtime grant denial stops remaining cases and cannot be treated as a correct knowledge gap', async () => {
  const run = await capture(options(), fakeTransport({ answer: 'Ich kann diese Anfrage im Moment nicht sicher mit dem freigegebenen Wissen abgleichen.' }));
  assert.equal(run.chatRequests, 1); assert.equal(run.stopReason, 'runtime_unavailable');
  assert.equal(run.cases[0].status, 'incomplete');
});
test('network failures stop once without retries or raw upstream details', async () => {
  const run = await capture(options(), fakeTransport({ failChat: true }));
  assert.equal(run.chatRequests, 1); assert.equal(run.cases[0].status, 'capture_error');
  assert.equal(JSON.stringify(run).includes('private upstream'), false);
});
test('HTTP denials release the response body without reading upstream error details', async () => {
  let calls = 0; let cancelled = false;
  const run = await capture(options(), { fetchImpl: async () => {
    if (++calls === 1) return Response.json({ id: 'session-denied' });
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 403 });
  } });
  assert.equal(calls, 2); assert.equal(cancelled, true);
  assert.equal(run.chatRequests, 1); assert.equal(run.cases[0].status, 'capture_error');
});
test('streamed content that differs from the final answer is a capture failure', async () => {
  const run = await capture(options({ modes: ['stream'] }), fakeTransport({ brokenStream: true }));
  assert.equal(run.chatRequests, 1); assert.equal(run.stopReason, 'transport_or_contract_error');
});
test('stream parser rejects incomplete, repeated and out-of-order events', async () => {
  const start = { type: 'start', sessionId: 's' }; const chunk = { type: 'chunk', delta: 'Antwort' };
  const done = { type: 'done', sessionId: 's', answer: 'Antwort', sources: [] };
  for (const events of [[start, chunk], [chunk, start, done], [start, chunk, done, done], [start, { type: 'error' }], [start, start, chunk, done]]) {
    await assert.rejects(readReply(new Response(events.map(JSON.stringify).join('\n')), 'stream', 's'));
  }
});
test('oversized and foreign-session responses are rejected', async () => {
  await assert.rejects(readReply(new Response('x'.repeat(262145)), 'normal', 's'), /limit/);
  await assert.rejects(readReply(Response.json({ sessionId: 'foreign', answer: 'Text', sources: [] }), 'normal', 's'), /contract/);
});
test('full captures without a manual review remain pending instead of becoming a 40/40 success', async () => {
  const { source, run } = await fullFixture(); const result = assess(source, [run], reviewTemplate([run]));
  assert.equal(result.status, 'incomplete'); assert.equal(result.passed, 0); assert.equal(result.pending, 40);
});
test('only both paths, all turns, all review dimensions and runtime evidence yield acceptance', async () => {
  const { source, run, review } = await fullFixture(); const result = assess(source, [run], review);
  assert.equal(result.status, 'passed'); assert.equal(result.passed, 40);
  assert.equal(result.retrievalRecall, 'not_measured_without_server_retrieval_trace');
  review.runtimeEvidence = ''; assert.equal(assess(source, [run], review).status, 'incomplete');
});
test('one incorrect statement fails its case even when citations and transport look valid', async () => {
  const { source, run, review } = await fullFixture(); review.runs[0].cases[0].turns[0].correctness = 'fail';
  const result = assess(source, [run], review); assert.equal(result.status, 'failed'); assert.equal(result.failed, 1); assert.equal(result.passed, 39);
});
test('partial capture keeps the full 40-case denominator and missing mode pending', async () => {
  const source = dataset(); const run = await capture(options({ dataset: source, modes: ['normal'], caseIds: ['P01'] }), fakeTransport());
  const review = reviewTemplate([run]); const result = assess(source, [run], review);
  assert.equal(result.total, 40); assert.equal(result.pending, 40); assert.equal(result.findings[0].modes.stream, 'missing');
});
test('stale or duplicated review evidence and mixed targets cannot grant acceptance', async () => {
  const { source, run, review } = await fullFixture();
  const altered = structuredClone(run); altered.cases[0].turns[0].answer = 'Changed';
  assert.throws(() => assess(source, [altered], review), /stale/);
  assert.throws(() => assess(source, [run, run], reviewTemplate([run, run])), /[Dd]uplicat/);
  const differentTarget = structuredClone(run); differentTarget.target.siteKey = 'another-site'; differentTarget.cases = [];
  assert.throws(() => assess(source, [run, differentTarget], reviewTemplate([run, differentTarget])), /Different targets/);
});
test('duplicate case/mode from retries cannot silently select the best answer', async () => {
  const { source, run } = await fullFixture(); const retry = structuredClone(run); retry.createdAt = 'later';
  assert.throws(() => assess(source, [run, retry], reviewTemplate([run, retry])), /Duplicate case/);
});
test('an existing output is preserved before any live capture could begin', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'knowledge-pilot-'));
  try {
    const file = path.join(directory, 'run.json'); await writeFile(file, 'existing');
    await assert.rejects(main(['capture', '--out', file, '--execute']), /EEXIST/);
    assert.equal(await readFile(file, 'utf8'), 'existing');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
