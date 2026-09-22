#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CATEGORY_COUNTS = { fact: 12, paraphrase: 8, multipart: 6, followup: 6, unanswerable: 4, adversarial: 4 };
export const DIMENSIONS = ['correctness', 'citationSupport', 'completeness', 'uncertainty', 'instructionSafety'];
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const MODES = ['normal', 'stream'];
const MAX_RESPONSE_BYTES = 262144;
export const digest = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };

export function validateDataset(dataset, { ready = false } = {}) {
  requireValue(dataset?.schemaVersion === 1 && dataset.suite === 'knowledge-pilot-40', 'Unsupported dataset');
  requireValue(Array.isArray(dataset.cases) && dataset.cases.length === 40, 'Exactly 40 pilot cases required');
  requireValue(text(dataset.corpus?.filename), 'Corpus filename required');
  const ids = new Set();
  const counts = Object.fromEntries(Object.keys(CATEGORY_COUNTS).map((key) => [key, 0]));
  const pending = [];
  for (const item of dataset.cases) {
    requireValue(/^P(?:0[1-9]|[1-3]\d|40)$/.test(item.id) && !ids.has(item.id), 'Invalid or duplicate case id');
    ids.add(item.id);
    requireValue(Object.hasOwn(counts, item.category), `Unknown category: ${item.id}`);
    counts[item.category]++;
    requireValue(Array.isArray(item.turns) && item.turns.length >= 1 && item.turns.length <= 3
      && item.turns.every((turn) => text(turn) && turn.length <= 1000), `Invalid turns: ${item.id}`);
    requireValue(item.category !== 'followup' || item.turns.length >= 2, `Follow-up context missing: ${item.id}`);
    const expected = item.expected;
    requireValue(text(expected?.criterion) && Array.isArray(expected.facts) && Array.isArray(expected.references)
      && Array.isArray(expected.forbiddenClaims), `Expected assessment missing: ${item.id}`);
    requireValue(['pending', 'verified'].includes(expected.corpusReview), `Invalid corpus review: ${item.id}`);
    if (expected.corpusReview !== 'verified') pending.push(item.id);
    if (expected.corpusReview === 'verified') {
      requireValue(text(expected.reviewNote), `Corpus review note required: ${item.id}`);
      if (item.category !== 'unanswerable') {
        requireValue(expected.facts.length > 0 && expected.facts.every(text), `Grounded facts missing: ${item.id}`);
        requireValue(expected.references.length > 0, `Grounded references missing: ${item.id}`);
      } else {
        requireValue(text(expected.absenceCheck), `Documented absence check missing: ${item.id}`);
      }
      requireValue(expected.references.every((ref) => text(ref.sourceTitle) && text(ref.locator) && text(ref.quote)),
        `Incomplete evidence reference: ${item.id}`);
    }
  }
  requireValue(Object.entries(CATEGORY_COUNTS).every(([key, count]) => counts[key] === count), 'Category distribution must be 12/8/6/6/4/4');
  if (ready) {
    requireValue(SHA256.test(dataset.corpus.sha256 || ''), 'Verified corpus SHA-256 required');
    requireValue(pending.length === 0, 'Corpus-grounded expectations are still pending');
  }
  return { total: 40, categories: counts, pendingCorpusReview: pending, ready: pending.length === 0 && SHA256.test(dataset.corpus.sha256 || '') };
}

function origin(value) {
  const url = new URL(value);
  requireValue(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)), 'HTTPS or loopback required');
  requireValue(!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash, 'Origin must not contain credentials, path or query');
  return url.origin;
}

function publicReply(reply, sessionId) {
  requireValue(reply && reply.sessionId === sessionId && text(reply.answer) && Array.isArray(reply.sources), 'Invalid public answer contract');
  requireValue(reply.sources.every((source) => source && typeof source === 'object' && !Array.isArray(source)), 'Invalid source contract');
  // Keep only the source fields needed by the reviewer, never arbitrary metadata.
  return { answer: reply.answer, sources: reply.sources.map((source) => Object.fromEntries(
    ['title', 'url', 'sourceId', 'type', 'excerpt'].filter((key) => typeof source[key] === 'string').map((key) => [key, source[key]]),
  )) };
}

export async function readReply(response, mode, sessionId) {
  requireValue(response.ok, `HTTP ${response.status}`);
  requireValue(response.body, 'Missing response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      requireValue(bytes <= MAX_RESPONSE_BYTES, 'Response exceeds capture limit');
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  if (mode === 'normal') return publicReply(JSON.parse(body), sessionId);
  let started = false;
  let final = null;
  let streamedText = '';
  for (const line of body.split(/\r?\n/).filter((entry) => entry.trim())) {
    const event = JSON.parse(line);
    requireValue(!final, 'Event after final answer');
    if (event.type === 'start') {
      requireValue(!started && event.sessionId === sessionId, 'Invalid stream start');
      started = true;
    } else if (event.type === 'chunk') {
      requireValue(started && typeof event.delta === 'string', 'Invalid stream chunk');
      streamedText += event.delta;
    } else if (event.type === 'done') {
      requireValue(started, 'Missing stream start');
      final = publicReply(event, sessionId);
    } else {
      throw new Error('Stream failed or contains an unknown event');
    }
  }
  requireValue(final && streamedText === final.answer, 'Incomplete or inconsistent stream');
  return final;
}

// Capture does not grade semantics. Every answer needs source-based review.
export async function capture({ dataset, corpusBytes, target, modes = MODES, caseIds, maxChatRequests = 6, execute = false },
  { fetchImpl = fetch, now = Date.now, uuid = randomUUID, checkpoint = async () => {} } = {}) {
  validateDataset(dataset, { ready: true });
  requireValue(digest(corpusBytes) === dataset.corpus.sha256, 'Corpus file differs from the reviewed snapshot');
  requireValue(execute === true, 'Live capture requires --execute');
  requireValue(COMMIT.test(target?.releaseSha || ''), 'Target release SHA required');
  requireValue(text(target?.siteKey) && target.siteKey.length <= 120, 'Target site key required');
  const apiOrigin = origin(target.apiOrigin);
  const widgetOrigin = origin(target.widgetOrigin);
  requireValue(Array.isArray(modes) && modes.length > 0 && new Set(modes).size === modes.length && modes.every((mode) => MODES.includes(mode)), 'Invalid modes');
  requireValue(Number.isInteger(maxChatRequests) && maxChatRequests >= 1 && maxChatRequests <= 120, 'Chat request limit must be 1..120');
  const selectedIds = caseIds || dataset.cases.map((item) => item.id);
  requireValue(selectedIds.length > 0 && new Set(selectedIds).size === selectedIds.length
    && selectedIds.every((id) => dataset.cases.some((item) => item.id === id)), 'Invalid case selection');
  const run = { schemaVersion: 1, kind: 'live_widget_capture', datasetHash: digest(JSON.stringify(dataset)),
    corpusHash: dataset.corpus.sha256, target: { apiOrigin, widgetOrigin, siteKey: target.siteKey, releaseSha: target.releaseSha },
    targetVerification: 'operator_supplied_not_verified_by_public_api', createdAt: new Date(now()).toISOString(),
    maxChatRequests, chatRequests: 0, modes, cases: [], stopReason: null,
    usage: { status: 'not_exposed_by_public_widget', tokens: null, cost: null } };
  const startedAt = now();
  const post = async (route, body) => {
    const remaining = 300_000 - (now() - startedAt);
    requireValue(remaining > 0, 'Run time budget exhausted');
    const response = await fetchImpl(`${apiOrigin}${route}`, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Origin: widgetOrigin, Referer: `${widgetOrigin}/` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(20_000, remaining)) });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  };
  for (const id of selectedIds) {
    const item = dataset.cases.find((candidate) => candidate.id === id);
    for (const mode of modes) {
      if (run.chatRequests + item.turns.length > maxChatRequests) { run.stopReason = 'chat_request_limit'; return run; }
      const record = { id, mode, status: 'incomplete', sessionId: null, turns: [] };
      run.cases.push(record);
      try {
        const visitorId = uuid();
        const sessionResponse = await post('/widget/session', { siteKey: target.siteKey, visitorId,
          sourceUrl: `${widgetOrigin}/`, userAgent: 'SSB knowledge pilot acceptance' });
        // Session payload is bounded using the same byte limit as answers.
        const sessionReader = sessionResponse.body?.getReader();
        requireValue(sessionReader, 'Missing session body');
        let sessionBytes = 0; let sessionText = ''; const sessionDecoder = new TextDecoder();
        try {
          while (true) {
            const part = await sessionReader.read(); if (part.done) break;
            sessionBytes += part.value.byteLength;
            requireValue(sessionBytes <= 8192, 'Session body exceeds limit');
            sessionText += sessionDecoder.decode(part.value, { stream: true });
          }
          sessionText += sessionDecoder.decode();
        } finally { await sessionReader.cancel().catch(() => {}); sessionReader.releaseLock(); }
        const session = JSON.parse(sessionText);
        requireValue(text(session.id) && session.id.length <= 120, 'Invalid session response');
        record.sessionId = session.id;
        await checkpoint(run);
        for (const question of item.turns) {
          const start = now();
          run.chatRequests++;
          const response = await post(`/widget/chat/${mode === 'stream' ? 'stream' : 'message'}`,
            { siteKey: target.siteKey, sessionId: session.id, visitorId, message: question });
          const reply = await readReply(response, mode, session.id);
          record.turns.push({ question, ...reply, latencyMs: Math.max(0, now() - start) });
          await checkpoint(run);
          if (/im Moment nicht sicher mit dem freigegebenen Wissen abgleichen|Antwortgenerierung ist derzeit nicht sicher/i.test(reply.answer)) {
            run.stopReason = 'runtime_unavailable'; return run;
          }
        }
        record.status = 'captured_pending_review';
      } catch {
        // Raw provider/network errors may contain private upstream detail.
        record.status = 'capture_error';
        run.stopReason = 'transport_or_contract_error';
        return run;
      }
    }
  }
  return run;
}

export function reviewTemplate(runs) {
  return { schemaVersion: 1, reviewer: null, reviewedAt: null, runtimeEvidence: null,
    runs: runs.map((run) => ({ hash: digest(JSON.stringify(run)), cases: run.cases.map((item) => ({
      id: item.id, mode: item.mode, turns: item.turns.map(() => ({
        ...Object.fromEntries(DIMENSIONS.map((key) => [key, 'pending'])), notes: '',
      })),
    })) })) };
}

export function assess(dataset, runs, review) {
  validateDataset(dataset, { ready: true });
  requireValue(Array.isArray(runs) && runs.length > 0 && review?.schemaVersion === 1, 'Capture and review required');
  const expectedHash = digest(JSON.stringify(dataset));
  const slots = new Map();
  const targets = new Set();
  const runHashes = new Set();
  requireValue(Array.isArray(review.runs) && review.runs.length === runs.length, 'Review/run count mismatch');
  for (const run of runs) {
    const hash = digest(JSON.stringify(run));
    requireValue(!runHashes.has(hash), 'Duplicate run'); runHashes.add(hash);
    requireValue(run.kind === 'live_widget_capture' && run.datasetHash === expectedHash
      && run.corpusHash === dataset.corpus.sha256 && COMMIT.test(run.target?.releaseSha || ''), 'Capture snapshot mismatch');
    targets.add(JSON.stringify(run.target));
    const matching = review.runs.filter((entry) => entry.hash === hash);
    requireValue(matching.length === 1, 'Missing, duplicated or stale review');
    const entries = matching[0].cases;
    requireValue(Array.isArray(entries) && entries.length === run.cases.length, 'Review case count mismatch');
    for (const item of run.cases) {
      const key = `${item.id}:${item.mode}`;
      requireValue(!slots.has(key), 'Duplicate case/mode; do not silently select a better rerun');
      const spec = dataset.cases.find((candidate) => candidate.id === item.id);
      requireValue(spec && MODES.includes(item.mode), 'Unknown captured case/mode');
      const selected = entries.filter((entry) => entry.id === item.id && entry.mode === item.mode);
      requireValue(selected.length === 1, 'Review case identity mismatch');
      const judgments = selected[0].turns;
      requireValue(Array.isArray(judgments) && judgments.length === item.turns.length, 'Review turn count mismatch');
      let status = 'pending';
      if (item.status === 'capture_error') status = 'failed';
      else if (item.status === 'captured_pending_review' && item.turns.length === spec.turns.length) {
        requireValue(item.turns.every((turn, index) => turn.question === spec.turns[index] && text(turn.answer)
          && Array.isArray(turn.sources) && Number.isFinite(turn.latencyMs) && turn.latencyMs >= 0), 'Capture turn mismatch');
        for (const judgment of judgments) {
          requireValue(DIMENSIONS.every((key) => ['pass', 'fail', 'pending'].includes(judgment[key])), 'Invalid review verdict');
        }
        if (judgments.some((judgment) => DIMENSIONS.some((key) => judgment[key] === 'fail'))) status = 'failed';
        else if (judgments.every((judgment) => text(judgment.notes) && DIMENSIONS.every((key) => judgment[key] === 'pass'))) status = 'passed';
      }
      slots.set(key, status);
    }
  }
  requireValue(targets.size === 1, 'Different targets/releases cannot share one acceptance');
  const findings = dataset.cases.map((item) => {
    const states = MODES.map((mode) => slots.get(`${item.id}:${mode}`) || 'missing');
    return { id: item.id, category: item.category, status: states.includes('failed') ? 'failed'
      : states.every((state) => state === 'passed') ? 'passed' : 'pending', modes: Object.fromEntries(MODES.map((mode, index) => [mode, states[index]])) };
  });
  const passed = findings.filter((item) => item.status === 'passed').length;
  const failed = findings.filter((item) => item.status === 'failed').length;
  const runtimeReviewed = text(review.reviewer) && text(review.reviewedAt) && text(review.runtimeEvidence);
  return { status: passed === 40 && runtimeReviewed ? 'passed' : failed ? 'failed' : 'incomplete', total: 40,
    passed, failed, pending: 40 - passed - failed, runtimeReviewed,
    evidenceLevel: 'public_widget_answers_and_manual_source_review',
    retrievalRecall: 'not_measured_without_server_retrieval_trace', usage: 'requires_separate_server_usage_evidence', findings };
}

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function saveJson(file, value) {
  requireValue(text(file), '--out is required');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}

export async function main(argv) {
  const [command, ...args] = argv;
  const options = {};
  const allowed = new Set(['dataset', 'corpus', 'target', 'out', 'mode', 'max-chat-requests', 'case-ids', 'execute', 'runs', 'review']);
  for (let i = 0; i < args.length; i++) {
    const key = args[i].replace(/^--/, '');
    requireValue(args[i].startsWith('--') && allowed.has(key) && !Object.hasOwn(options, key), 'Unknown or duplicate option');
    if (key === 'execute') options[key] = true;
    else { requireValue(text(args[i + 1]) && !args[i + 1].startsWith('--'), `Value missing: ${key}`); options[key] = args[++i]; }
  }
  if (command === 'validate') {
    const result = validateDataset(await readJson(options.dataset));
    console.log(JSON.stringify(result, null, 2)); return result.ready ? 0 : 2;
  }
  if (command === 'capture') {
    requireValue(text(options.out), '--out is required');
    await mkdir(path.dirname(options.out), { recursive: true, mode: 0o700 });
    // Reserve output before any paid call; an existing capture must not be lost.
    const output = await open(options.out, 'wx', 0o600);
    await output.close();
    const checkpoint = async (run) => writeFile(options.out, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
    const run = await capture({ dataset: await readJson(options.dataset), corpusBytes: await readFile(options.corpus),
      target: await readJson(options.target), modes: options.mode === undefined || options.mode === 'both' ? MODES : [options.mode],
      caseIds: options['case-ids']?.split(','), maxChatRequests: options['max-chat-requests'] === undefined ? 6 : Number(options['max-chat-requests']),
      execute: options.execute === true }, { checkpoint });
    await checkpoint(run);
    console.log(JSON.stringify({ casesCaptured: run.cases.length, chatRequests: run.chatRequests, stopReason: run.stopReason, verdict: 'not_graded' }));
    return run.stopReason && run.stopReason !== 'chat_request_limit' ? 2 : 0;
  }
  if (command === 'review-template' || command === 'assess') {
    requireValue(text(options.runs), '--runs is required');
    const runs = await Promise.all(options.runs.split(',').map(readJson));
    const result = command === 'review-template' ? reviewTemplate(runs)
      : assess(await readJson(options.dataset), runs, await readJson(options.review));
    await saveJson(options.out, result);
    if (command === 'assess') console.log(JSON.stringify({ status: result.status, total: 40, passed: result.passed, failed: result.failed, pending: result.pending }));
    return command === 'assess' && result.status !== 'passed' ? 2 : 0;
  }
  throw new Error('Use validate, capture, review-template or assess');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => {
    console.error('Knowledge-pilot evaluation could not complete. Check dataset, corpus, target, output path and review files.');
    process.exitCode = 2;
  });
}
