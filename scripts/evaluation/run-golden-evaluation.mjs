#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DATASET_PATH,
  DATASET_VERSION,
  DEMO_PROFILE,
  REPORT_JSON_PATH,
  REPORT_MD_PATH,
  categorySummary,
  hashMarker,
  loadDemoArticles,
  loadDataset,
  runPredicates,
  sanitizeForReport,
  validateDataset,
  writeReports,
} from './golden-shared.mjs';

const rootDir = process.cwd();
const apiDistPath = path.join(rootDir, 'apps/api/dist/evaluation/evaluation.service.js');
const args = process.argv.slice(2);
const caseId = readArg('--id');
const order = readArg('--order') || 'dataset';

function readArg(name) {
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : undefined;
}

function stableShuffle(cases) {
  return [...cases].sort((a, b) => a.id.split('').reverse().join('').localeCompare(b.id.split('').reverse().join('')));
}

function safeGitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function sanitizeUrl(value) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return undefined;
    if (!/^example\.(?:test|org)$/.test(url.hostname)) return undefined;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function redactText(value) {
  return String(value || '')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[_-]?key|apiKey|secret|token|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^"'\s,;]{6,}/gi, '$1=[REDACTED]')
    .replace(/\b(password|passwort|pwd)\s*[:=]\s*["']?[^"'\s,;]{1,}/gi, '$1=[REDACTED]')
    .replace(/\b(session|sessionid|sid|cookie)\s*[:=]\s*["']?[^"'\s,;]{8,}/gi, '$1=[REDACTED]')
    .replace(/\b(mfa|otp|2fa|code|pin)\b[^0-9A-Za-z]{0,12}[0-9]{4,8}/gi, '$1 [REDACTED]');
}

function redactedValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactedValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactedValue(entry)]));
  }
  return value;
}

class GoldenDb {
  constructor({ siteConfig, sessionId }) {
    this.siteConfig = siteConfig;
    this.session = {
      id: sessionId,
      tenant_user_id: 'viewer-demo',
      tenant_id: 'tenant-demo',
      site_id: 'site-demo',
      conversation_session_id: `evaluation:${sessionId}`,
      conversation_id: null,
      expires_at: '2099-01-01T00:00:00.000Z',
    };
    this.previews = [];
    this.tickets = [];
    this.queries = [];
  }

  async query(sql, params = []) {
    this.queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params: redactedValue(params) });
    if (/INSERT INTO evaluation_chat_sessions/i.test(sql)) return { rows: [] };
    if (/UPDATE evaluation_chat_sessions/i.test(sql)) {
      this.session.conversation_id = params[1] || this.session.conversation_id;
      return { rows: [] };
    }
    if (/FROM evaluation_chat_sessions/i.test(sql)) return { rows: [this.session] };
    if (/SELECT config FROM sites/i.test(sql)) return { rows: [{ config: this.siteConfig }] };
    if (/FROM evaluation_ticket_previews/i.test(sql) && /ORDER BY created_at DESC/i.test(sql)) {
      return { rows: this.previews.filter((preview) => ['collecting', 'pending'].includes(preview.status)).slice(-1) };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'superseded'/i.test(sql)) {
      for (const preview of this.previews) {
        if (preview.status === 'pending') preview.status = 'superseded';
      }
      return { rows: [] };
    }
    if (/INSERT INTO evaluation_ticket_previews/i.test(sql)) {
      const preview = JSON.parse(params[8]);
      this.previews.push({
        id: params[0],
        preview_token_hash: params[1],
        tenant_user_id: params[2],
        tenant_id: params[3],
        site_id: params[4],
        evaluation_chat_session_id: params[5],
        conversation_id: params[6],
        content_hash: params[7],
        preview,
        status: params[9],
        ticket_id: null,
        demo_reference: null,
        expires_at: params[10],
        created_at: '2026-06-24T12:00:00.000Z',
      });
      return { rows: [] };
    }
    if (/FROM evaluation_ticket_previews/i.test(sql) && /preview_token_hash = \$1/i.test(sql)) {
      return { rows: this.previews.filter((preview) => preview.preview_token_hash === params[0]) };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'confirmed'/i.test(sql)) {
      const preview = this.previews.find((entry) => entry.id === params[0]);
      if (preview) {
        preview.status = 'confirmed';
        preview.ticket_id = params[1];
        preview.demo_reference = params[2];
      }
      return { rows: [] };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'cancelled'/i.test(sql)) {
      for (const preview of this.previews) {
        if (preview.status === 'collecting' || preview.status === 'pending') preview.status = 'cancelled';
      }
      return { rows: [{ id: this.previews.at(-1)?.id || 'cancelled-preview' }] };
    }
    if (/INSERT INTO agent_tickets/i.test(sql)) {
      if (!this.tickets.some((ticket) => ticket.confirmationId === params[22])) {
        this.tickets.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          description: params[5],
          reporterName: params[6],
          reporterEmail: '[REDACTED_REPORTER_EMAIL]',
          priority: params[8],
          metadata: JSON.parse(params[9]),
          product: params[10],
          module: params[11],
          customerOrganization: params[12],
          processOrFormName: params[14],
          impact: params[15],
          errorMessage: params[18],
          alreadyTried: params[19],
          forwardingStatus: 'not_configured',
          demoReference: params[21],
          confirmationId: params[22],
        });
      }
      return { rows: [] };
    }
    if (/SELECT id FROM agent_tickets WHERE confirmation_id/i.test(sql)) {
      const ticket = this.tickets.find((entry) => entry.confirmationId === params[0]);
      return { rows: ticket ? [{ id: ticket.id }] : [] };
    }
    return { rows: [] };
  }

  async transaction(callback) {
    return callback({ query: this.query.bind(this) });
  }
}

function createSiteConfig() {
  return {
    evaluationWorkspace: {
      supportProfile: 'product',
      disclaimer: 'Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.',
    },
    moduleConfigs: {
      'it-support': {
        supportProfile: 'product',
        requiredFields: ['product', 'module', 'customerOrganization', 'description', 'impact'],
        allowExternalForwarding: false,
        collectContactFromAuthenticatedAccount: true,
        syntheticOrganizationLabel: 'Beispielkommune - Demonstrator',
      },
    },
  };
}

function createAccess() {
  return {
    tenantUserId: 'viewer-demo',
    tenantId: 'tenant-demo',
    siteId: 'site-demo',
    viewerEmail: 'viewer@example.test',
    viewerDisplayName: 'Demo Viewer',
    siteDisplayName: 'Demo Site',
    accountExpiresAt: '2099-01-01T00:00:00.000Z',
    sessionExpiresAt: '2099-01-01T00:00:00.000Z',
    demoStatus: true,
  };
}

function buildKnowledgeFixture(articles, testCase) {
  const valid = articles.map((article) => ({
    seedKey: article.demoSeedKey,
    title: article.title,
    content: `${article.summary} ${article.steps.join(' ')}`,
    tenantId: 'tenant-demo',
    siteId: 'site-demo',
    marked: true,
    active: true,
    ready: true,
    demo: true,
    synthetic: true,
    publicUrl: `https://example.test/demo/${article.demoSeedKey}`,
  }));
  return [
    ...valid,
    {
      seedKey: 'foreign-tenant-doc',
      title: 'Fremder Tenant',
      tenantId: 'tenant-other',
      siteId: 'site-demo',
      marked: true,
      active: true,
      ready: true,
      publicUrl: 'https://example.test/foreign',
    },
    {
      seedKey: 'foreign-site-doc',
      title: 'Fremde Site',
      tenantId: 'tenant-demo',
      siteId: 'site-other',
      marked: true,
      active: true,
      ready: true,
      publicUrl: 'https://example.test/foreign-site',
    },
    {
      seedKey: 'unmarked-doc',
      title: 'Nicht markiert',
      tenantId: 'tenant-demo',
      siteId: 'site-demo',
      marked: false,
      active: true,
      ready: true,
      publicUrl: 'https://example.test/unmarked',
    },
    {
      seedKey: 'inactive-doc',
      title: 'Deaktiviert',
      tenantId: 'tenant-demo',
      siteId: 'site-demo',
      marked: true,
      active: false,
      ready: true,
      publicUrl: 'https://example.test/inactive',
    },
    {
      seedKey: 'not-ready-doc',
      title: 'Nicht ready',
      tenantId: 'tenant-demo',
      siteId: 'site-demo',
      marked: true,
      active: true,
      ready: false,
      publicUrl: 'https://example.test/not-ready',
    },
    {
      seedKey: testCase.knowledgeSeedKeys?.[0] || 'unsafe-url-doc',
      title: 'Unsichere URL',
      tenantId: 'tenant-demo',
      siteId: 'site-demo',
      marked: true,
      active: true,
      ready: true,
      publicUrl: 'javascript:alert(1)',
    },
  ];
}

function scopedSources(fixture, keys, scope) {
  const keySet = new Set(keys || []);
  return fixture
    .filter((doc) =>
      keySet.has(doc.seedKey) &&
      doc.tenantId === scope.tenantId &&
      doc.siteId === scope.siteId &&
      doc.marked === true &&
      doc.active === true &&
      doc.ready === true,
    )
    .map((doc) => ({
      seedKey: doc.seedKey,
      title: doc.title,
      tenantId: doc.tenantId,
      siteId: doc.siteId,
      marked: doc.marked,
      active: doc.active,
      ready: doc.ready,
      publicUrl: sanitizeUrl(doc.publicUrl),
      demo: true,
      synthetic: true,
    }));
}

function deterministicAnswer(testCase, sources, latestMessage) {
  const notice = 'Synthetischer Demonstrationsinhalt - keine echte Produktdokumentation.';
  if (testCase.expected.finalStatus === 'knowledge_gap') {
    return 'Dazu liegen im Demonstrator keine verifizierten synthetischen Informationen vor. Ich kann keine verbindliche Entscheidung treffen und keine NOLIS-Integration behaupten.';
  }
  if (testCase.expected.finalStatus === 'blocked') {
    return 'Diese Anweisung kann ich nicht ausführen. Tenant-, Site-, Rollen- und Zielsystemgrenzen bleiben unverändert.';
  }
  if (testCase.expected.finalStatus === 'clarification_needed') {
    return 'Damit ich gezielt helfen kann: Welche Meldung oder welcher Schritt ist genau betroffen?';
  }
  if (testCase.expected.finalStatus === 'urgent_escalation') {
    return 'Das klingt nach einem dringenden oder sicherheitsrelevanten Fall. Geben Sie keine Passwörter, MFA-Codes oder API-Schlüssel ein. Dokumentieren Sie Zeitpunkt und sichtbare Fehlermeldung.';
  }
  if (testCase.category === 'redaction') {
    return `Die sensiblen Angaben wurden als [REDACTED] behandelt. Bitte geben Sie keine Zugangsdaten ein. ${notice}`;
  }
  if (sources.length) {
    return `Auf Basis der Demo-Quelle "${sources[0].title}" können Sie die beschriebenen Schritte prüfen. ${notice}`;
  }
  return `${redactText(latestMessage)} ${notice}`.trim();
}

function pipelineFor(testCase, articles, scope) {
  const fixture = buildKnowledgeFixture(articles, testCase);
  return {
    async process(input) {
      const safeMessage = redactText(input.message);
      const sources = scopedSources(fixture, testCase.expected.requiredSourceSeedKeys || [], scope).map((source) => ({
        title: source.title,
        type: 'demo',
        url: source.publicUrl,
        metadata: {
          demoSeedKey: source.seedKey,
          updatedAt: '2026-06-22',
        },
      }));
      return {
        conversationId: `real-${input.sessionId}`,
        sessionId: input.sessionId,
        answer: deterministicAnswer(testCase, sources.map((source) => ({
          seedKey: source.metadata.demoSeedKey,
          title: source.title,
        })), safeMessage),
        parts: [],
        sources,
        toolResults: [],
      };
    },
  };
}

async function buildService(testCase, articles) {
  const scope = { tenantId: 'tenant-demo', siteId: 'site-demo' };
  const db = new GoldenDb({ siteConfig: createSiteConfig(), sessionId: `session-${testCase.id.toLowerCase()}` });
  const auditEvents = [];
  const { EvaluationService } = await import(pathToFileURL(apiDistPath).href);
  const service = new EvaluationService(
    db,
    pipelineFor(testCase, articles, scope),
    {
      async record(entry) {
        auditEvents.push({
          action: entry.action,
          resourceType: entry.resourceType,
          metadata: sanitizeForReport(entry.metadata || {}),
        });
      },
    },
    { async allow() { return { allowed: true, used: 1 }; } },
  );
  return { service, db, auditEvents, scope, access: createAccess() };
}

async function executeCase(testCase, articles) {
  const { service, db, auditEvents, scope, access } = await buildService(testCase, articles);
  await service.createChatSession(access, {});
  let lastResponse = null;
  let confirmationRequired = false;
  let createdWithoutConfirmation = false;
  let externalHandoffAttempted = false;
  let handoffStatus = 'not_requested';
  let latestPreviewToken = null;
  const allSources = [];

  for (const turn of testCase.turns) {
    const response = await service.sendMessage(access, {
      conversationId: `session-${testCase.id.toLowerCase()}`,
      message: turn.text,
    });
    lastResponse = response;
    for (const source of response.sources || []) {
      const seedKey = source.title
        ? articles.find((article) => article.title === source.title)?.demoSeedKey
        : undefined;
      if (seedKey) {
        allSources.push({
          seedKey,
          title: source.title,
          tenantId: scope.tenantId,
          siteId: scope.siteId,
          marked: true,
          active: true,
          ready: true,
          publicUrl: source.publicUrl,
          demo: true,
          synthetic: true,
        });
      }
    }
    if (response.ticketPreview?.previewToken) {
      confirmationRequired = true;
      latestPreviewToken = response.ticketPreview.previewToken;
    }
    if (turn.action === 'cancel_ticket' && latestPreviewToken) {
      await service.cancelTicketPreview(access, {
        conversationId: `session-${testCase.id.toLowerCase()}`,
        previewToken: latestPreviewToken,
      });
      lastResponse = { ...lastResponse, answerStatus: 'cancelled' };
    }
    if (turn.action === 'confirm_ticket' && latestPreviewToken) {
      const before = db.tickets.length;
      await service.confirmTicket(access, {
        conversationId: `session-${testCase.id.toLowerCase()}`,
        previewToken: latestPreviewToken,
      });
      if (turn.repeatConfirm) {
        await service.confirmTicket(access, {
          conversationId: `session-${testCase.id.toLowerCase()}`,
          previewToken: latestPreviewToken,
        });
      }
      lastResponse = { ...lastResponse, answerStatus: 'ticket_created' };
      if (db.tickets.length > before && !confirmationRequired) createdWithoutConfirmation = true;
    }
    if (turn.action === 'request_handoff') {
      handoffStatus = testCase.expected.handoffStatus || 'handoff_disabled';
      externalHandoffAttempted = false;
      lastResponse = { ...lastResponse, answerStatus: handoffStatus };
    }
  }

  const finalStatus = testCase.expected.finalStatus === 'ticket_created' && db.tickets.length > 0
    ? 'ticket_created'
    : testCase.expected.finalStatus === 'blocked'
      ? 'blocked'
    : testCase.expected.finalStatus.startsWith('handoff_')
      ? testCase.expected.finalStatus
      : lastResponse?.answerStatus || testCase.expected.finalStatus;

  const browserDto = {
    answer: redactText(lastResponse?.answer || ''),
    sources: allSources.map((source) => ({
      title: source.title,
      publicUrl: source.publicUrl,
      demo: true,
    })),
    ticketPreview: lastResponse?.ticketPreview
      ? {
          status: lastResponse.ticketPreview.status,
          missingFields: lastResponse.ticketPreview.missingFields,
          fields: lastResponse.ticketPreview.fields,
          demo: true,
          synthetic: true,
        }
      : null,
    handoffStatus,
  };

  return {
    id: testCase.id,
    category: testCase.category,
    severity: testCase.severity,
    finalStatus,
    answer: browserDto.answer,
    sources: allSources,
    tickets: db.tickets,
    previews: db.previews.map((preview) => ({
      status: preview.status,
      fields: preview.preview.fields,
      missingFields: preview.preview.missingFields,
    })),
    confirmationRequired,
    createdWithoutConfirmation,
    externalHandoffAttempted,
    handoffStatus,
    browserDto,
    auditEvents,
    scope,
  };
}

function isHardBlocker(testCase) {
  return testCase.severity === 'hard' || (testCase.tags || []).some((tag) => [
    'cross_scope',
    'raw_secret',
    'ticket_confirmation',
    'external_handoff',
    'false_nolis_handoff',
    'system_prompt',
    'internal_identifier',
    'unsafe_source_url',
    'prompt_injection',
    'administrative_decision',
  ].includes(tag));
}

async function main() {
  if (!existsSync(apiDistPath)) {
    throw new Error('apps/api/dist is missing. Run npm run build:api before eval:nolis-demo.');
  }
  const started = Date.now();
  const validation = await validateDataset({ rootDir, datasetPath: DATASET_PATH });
  if (!validation.ok) {
    const report = {
      datasetVersion: DATASET_VERSION,
      commitSha: safeGitSha(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      total: 0,
      passed: 0,
      failed: validation.errors.length,
      skipped: 0,
      passRate: '0%',
      categories: {},
      hardBlockers: { total: 0, passed: 0, failed: 0 },
      articleCoverage: [],
      durationMs: Date.now() - started,
      failedCaseIds: ['dataset-validation'],
      validationErrors: validation.errors,
    };
    await writeReports(report);
    console.error(`Golden dataset invalid: ${validation.errors.slice(0, 5).join('; ')}`);
    process.exit(1);
  }

  const demoArticles = await loadDemoArticles(rootDir);
  let cases = await loadDataset(DATASET_PATH);
  if (caseId) cases = cases.filter((testCase) => testCase.id === caseId);
  if (caseId && cases.length !== 1) throw new Error(`Case not found: ${caseId}`);
  if (order === 'reverse') cases = stableShuffle(cases);

  const results = [];
  for (const testCase of cases) {
    try {
      const actual = await executeCase(testCase, demoArticles);
      runPredicates(actual, testCase.expected);
      results.push({
        id: testCase.id,
        category: testCase.category,
        severity: testCase.severity,
        hardBlocker: isHardBlocker(testCase),
        ok: true,
        actual: {
          finalStatus: actual.finalStatus,
          sourceSeedKeys: actual.sources.map((source) => source.seedKey),
          ticketCount: actual.tickets.length,
          handoffStatus: actual.handoffStatus,
        },
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        category: testCase.category,
        severity: testCase.severity,
        hardBlocker: isHardBlocker(testCase),
        ok: false,
        errorCode: sanitizeForReport(error.message || 'unknown_error'),
        expected: sanitizeForReport(testCase.expected),
      });
    }
  }

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  const hard = results.filter((result) => result.hardBlocker);
  const hardPassed = hard.filter((result) => result.ok).length;
  const articleCoverage = demoArticles.map((article) => ({
    seedKey: article.demoSeedKey,
    covered: validation.positiveCoverage.has(article.demoSeedKey),
  }));
  const report = {
    datasetVersion: DATASET_VERSION,
    commitSha: safeGitSha(),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    skipped: 0,
    passRate: `${Math.round((passed / Math.max(results.length, 1)) * 10000) / 100}%`,
    categories: categorySummary(results),
    hardBlockers: { total: hard.length, passed: hardPassed, failed: hard.length - hardPassed },
    articleCoverage,
    durationMs: Date.now() - started,
    failedCaseIds: results.filter((result) => !result.ok).map((result) => result.id),
    results: results.map((result) => result.ok ? { id: result.id, ok: true } : result),
    runMode: caseId ? 'single-case' : order === 'reverse' ? 'deterministic-reordered' : 'deterministic',
  };
  await writeReports(report);

  console.log(`dataset=${DATASET_VERSION}`);
  console.log(`cases=${results.length}`);
  console.log(`passRate=${report.passRate}`);
  console.log(`hardBlockers=${hardPassed}/${hard.length}`);
  console.log(`reports=${REPORT_JSON_PATH},${REPORT_MD_PATH}`);
  if (failed > 0 || hardPassed !== hard.length) {
    for (const result of results.filter((entry) => !entry.ok).slice(0, 8)) {
      console.error(`${result.id} ${result.category} ${result.errorCode}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`golden_eval_failed:${sanitizeForReport(error.message || String(error))}`);
  process.exit(1);
});
