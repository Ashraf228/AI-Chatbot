#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { Pool } from 'pg';

const MODULE_KEY = 'conversation-engine-tests';
const REPORT_DIR = path.join(process.cwd(), 'apps/api/reports/conversation-engine-evaluation');

export const STARTER_TEST_CASES = [
  {
    name: 'Support',
    message: 'Ich brauche Hilfe, mein VPN funktioniert nicht.',
    expectedIntent: 'support',
    expectedGoal: 'solve_problem',
    expectedAgentKey: 'support-agent',
  },
  {
    name: 'Wissensfrage',
    message: 'Welche Leistungen bieten Sie an?',
    expectedIntent: 'question',
    expectedGoal: 'answer_from_knowledge',
    expectedAgentKey: 'knowledge-agent',
  },
  {
    name: 'Preisfrage',
    message: 'Was kostet das?',
    expectedIntent: 'sales',
    expectedGoal: 'prepare_contact|answer_from_knowledge',
  },
  {
    name: 'Termin',
    message: 'Ich möchte einen Termin vereinbaren.',
    expectedIntent: 'appointment',
    expectedGoal: 'prepare_contact|trigger_integration',
  },
  {
    name: 'Angebot',
    message: 'Können Sie mir dazu ein Angebot machen?',
    expectedIntent: 'sales|handoff',
    expectedGoal: 'prepare_contact',
  },
  {
    name: 'Unklarer Bedarf',
    message: 'Ich weiß nicht genau, was ich brauche.',
    expectedIntent: 'unknown',
    expectedGoal: 'clarify_intent',
  },
  {
    name: 'Beschwerde',
    message: 'Ich bin unzufrieden, weil sich niemand gemeldet hat.',
    expectedIntent: 'complaint',
    expectedGoal: 'escalate_human|prepare_contact',
  },
  {
    name: 'Produktberatung',
    message: 'Welches Produkt passt für unser Unternehmen?',
    expectedIntent: 'product_advice',
    expectedGoal: 'recommend_product',
  },
];

export function parseArgs(argv = process.argv.slice(2)) {
  const read = (name) => {
    const index = argv.indexOf(name);
    if (index >= 0) return argv[index + 1];
    const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
    return prefixed ? prefixed.slice(name.length + 1) : undefined;
  };
  return {
    tenantId: read('--tenantId'),
    siteId: read('--siteId'),
    enableFlags: argv.includes('--enable-flags'),
    seedStarterCases: argv.includes('--seed-starter-cases'),
    run: argv.includes('--run'),
    output: read('--output') || 'json',
    dryRun: argv.includes('--dry-run'),
    allowInternalEvaluation: argv.includes('--allow-internal-evaluation'),
    includeResponsePreview: argv.includes('--include-response-preview'),
  };
}

export function redactText(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[E-MAIL]')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '[TELEFON]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+)\b/g, '[SECRET]')
    .replace(/\b(password|secret|token|api[_-]?key)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]');
}

export function sanitizeValue(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]));
  }
  return value;
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function assertInternalEvaluationAllowed({ site, allowInternalEvaluation, nodeEnv = process.env.NODE_ENV }) {
  if (nodeEnv === 'production') {
    throw new Error('Conversation-Engine-Evaluation darf nicht mit NODE_ENV=production ausgeführt werden.');
  }

  const config = asRecord(site.config);
  const domains = [
    ...(Array.isArray(site.allowed_domains) ? site.allowed_domains : []),
    config.domain,
    config.websiteUrl,
  ].filter((entry) => typeof entry === 'string');
  const hasSafeEnvironment = config.environment === 'test' || config.environment === 'demo';
  const isInternal = config.internalTestSite === true;
  const hasDemoDomain = domains.some((domain) => /\b(localhost|staging|demo|test)\b/i.test(domain));

  if (hasSafeEnvironment || isInternal || hasDemoDomain || allowInternalEvaluation === true) {
    return true;
  }

  throw new Error('Site ist nicht als interne Test-/Demo-Site markiert. Evaluation abgebrochen.');
}

function normalizeConfig(config = {}) {
  const source = asRecord(config);
  const engine = asRecord(source.conversationEngine);
  return {
    conversationEngine: {
      previewEnabled: engine.previewEnabled === true,
      compareEnabled: engine.compareEnabled === true,
      responsePreviewEnabled: engine.responsePreviewEnabled === true,
      adminTestOnly: true,
    },
    testCases: asArray(source.testCases).map((entry) => ({
      ...asRecord(entry),
      name: redactText(asRecord(entry).name || 'Testfall'),
      message: redactText(asRecord(entry).message || ''),
    })).filter((entry) => entry.id && entry.message),
    lastMetrics: asRecord(source.lastMetrics),
  };
}

function idForStarter(testCase) {
  return `starter_${testCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.replace(/_+$/g, '');
}

export function seedStarterCases(config) {
  const next = normalizeConfig(config);
  const existingMessages = new Set(next.testCases.map((entry) => String(entry.message).toLowerCase()));
  for (const starter of STARTER_TEST_CASES) {
    if (existingMessages.has(starter.message.toLowerCase())) {
      continue;
    }
    const now = new Date().toISOString();
    next.testCases.push({
      id: idForStarter(starter),
      name: starter.name,
      message: starter.message,
      expectedIntent: starter.expectedIntent,
      expectedGoal: starter.expectedGoal,
      expectedAgentKey: starter.expectedAgentKey,
      createdAt: now,
      updatedAt: now,
    });
    existingMessages.add(starter.message.toLowerCase());
  }
  return next;
}

function enableFlags(config, includeResponsePreview = false) {
  return {
    ...normalizeConfig(config),
    conversationEngine: {
      previewEnabled: true,
      compareEnabled: true,
      responsePreviewEnabled: includeResponsePreview === true || config.conversationEngine?.responsePreviewEnabled === true,
      adminTestOnly: true,
    },
  };
}

function expectedMatches(expected, actual) {
  if (!expected) return null;
  return String(expected).split('|').map((entry) => entry.trim()).includes(actual || '');
}

export function calculateEvaluationMetrics(results) {
  const counts = {
    totalCases: results.length,
    alignedCount: 0,
    partialCount: 0,
    conflictCount: 0,
    unknownCount: 0,
    intentAccuracy: 0,
    goalAccuracy: 0,
    agentAccuracy: 0,
    handoffMismatchCount: 0,
    knowledgeMismatchCount: 0,
    localServiceBiasCount: 0,
  };
  let intentExpected = 0;
  let intentCorrect = 0;
  let goalExpected = 0;
  let goalCorrect = 0;
  let agentExpected = 0;
  let agentCorrect = 0;

  for (const result of results) {
    const statusKey = `${result.comparisonStatus}Count`;
    if (statusKey in counts) counts[statusKey] += 1;
    const intentMatch = expectedMatches(result.expectedIntent, result.engineIntent);
    const goalMatch = expectedMatches(result.expectedGoal, result.engineGoal);
    const agentMatch = expectedMatches(result.expectedAgentKey, result.engineAgent);
    if (intentMatch !== null) {
      intentExpected += 1;
      if (intentMatch) intentCorrect += 1;
    }
    if (goalMatch !== null) {
      goalExpected += 1;
      if (goalMatch) goalCorrect += 1;
    }
    if (agentMatch !== null) {
      agentExpected += 1;
      if (agentMatch) agentCorrect += 1;
    }

    if (result.legacyRoute === 'lead_capture' && !['handoff', 'sales', 'appointment'].includes(result.engineIntent)) {
      counts.handoffMismatchCount += 1;
    }
    if (result.legacyUsedKnowledge !== true && result.engineGoal === 'answer_from_knowledge') {
      counts.knowledgeMismatchCount += 1;
    }
    const expectedGeneral = /support|question|product_advice/.test(String(result.expectedIntent || ''));
    if (expectedGeneral && (result.legacyRoute === 'local_service_intake' || result.profileKey === 'local-service-first-contact')) {
      counts.localServiceBiasCount += 1;
    }
  }

  counts.intentAccuracy = intentExpected ? Number((intentCorrect / intentExpected).toFixed(3)) : 0;
  counts.goalAccuracy = goalExpected ? Number((goalCorrect / goalExpected).toFixed(3)) : 0;
  counts.agentAccuracy = agentExpected ? Number((agentCorrect / agentExpected).toFixed(3)) : 0;
  return counts;
}

export function calculateResponseQualitySummary(results) {
  const summary = {
    totalWithPreview: 0,
    goodCount: 0,
    needsReviewCount: 0,
    riskyCount: 0,
    unknownCount: 0,
    averageQualityScore: 0,
    lowestQualityScore: null,
    highestQualityScore: null,
    riskyTestCaseNames: [],
    commonRisks: [],
    commonRecommendations: [],
  };
  const scores = [];
  const riskCounts = new Map();
  const recommendationCounts = new Map();

  for (const result of results) {
    const preview = asRecord(result.responsePreview);
    if (Object.keys(preview).length === 0) continue;
    summary.totalWithPreview += 1;
    const status = String(preview.qualityStatus || 'unknown');
    const score = Number(preview.qualityScore);
    if (Number.isFinite(score)) scores.push(score);
    if (status === 'good') summary.goodCount += 1;
    else if (status === 'needs_review') summary.needsReviewCount += 1;
    else if (status === 'risky') {
      summary.riskyCount += 1;
      summary.riskyTestCaseNames.push(result.name);
    } else {
      summary.unknownCount += 1;
    }

    for (const risk of asArray(preview.qualityRisks)) {
      if (typeof risk === 'string' && risk.trim()) riskCounts.set(risk, (riskCounts.get(risk) || 0) + 1);
    }
    for (const recommendation of asArray(preview.qualityRecommendations)) {
      if (typeof recommendation === 'string' && recommendation.trim()) {
        recommendationCounts.set(recommendation, (recommendationCounts.get(recommendation) || 0) + 1);
      }
    }
  }

  if (scores.length > 0) {
    summary.averageQualityScore = Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1));
    summary.lowestQualityScore = Math.min(...scores);
    summary.highestQualityScore = Math.max(...scores);
  }
  const top = (entries) =>
    Array.from(entries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));
  summary.commonRisks = top(riskCounts);
  summary.commonRecommendations = top(recommendationCounts);
  return summary;
}

function summarizePatterns(results) {
  const count = (items) => {
    const map = new Map();
    for (const item of items.filter(Boolean)) map.set(item, (map.get(item) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, total]) => ({ label, total }));
  };
  return {
    wrongIntents: count(results.filter((r) => expectedMatches(r.expectedIntent, r.engineIntent) === false).map((r) => `${r.expectedIntent} -> ${r.engineIntent}`)),
    wrongGoals: count(results.filter((r) => expectedMatches(r.expectedGoal, r.engineGoal) === false).map((r) => `${r.expectedGoal} -> ${r.engineGoal}`)),
    wrongAgents: count(results.filter((r) => expectedMatches(r.expectedAgentKey, r.engineAgent) === false).map((r) => `${r.expectedAgentKey} -> ${r.engineAgent || 'kein Agent'}`)),
    localServiceBias: count(results.filter((r) => r.legacyRoute === 'local_service_intake').map((r) => r.name)),
    missingKnowledge: count(results.filter((r) => r.engineGoal === 'answer_from_knowledge' && r.legacyUsedKnowledge !== true).map((r) => r.name)),
    missingHandoffRules: count(results.filter((r) => r.handoffMismatch === true).map((r) => r.name)),
    missingAgents: count(results.filter((r) => !r.engineAgent).map((r) => r.name)),
  };
}

async function loadDistServices() {
  const dist = path.join(process.cwd(), 'apps/api/dist');
  const [
    { AssistantProfileResolverService },
    { ConversationEngineService },
    { ConversationEngineCompareService },
    { ConversationContextService },
    { IntentClassifierService },
    { GoalDetectorService },
    { AgentSelectorService },
    { NextActionService },
    { HandoffReadinessService },
    { ConversationQualityService },
    { ResponseDraftService },
  ] = await Promise.all([
    import(pathToFileURL(path.join(dist, 'assistant-profiles/assistant-profile-resolver.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/conversation-engine.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/conversation-engine-compare.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/conversation-context.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/intent-classifier.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/goal-detector.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/agent-selector.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/next-action.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/handoff-readiness.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/conversation-quality.service.js')).href),
    import(pathToFileURL(path.join(dist, 'conversation-engine/response-draft.service.js')).href),
  ]);
  const qualityService = new ConversationQualityService();
  const engine = new ConversationEngineService(
    new ConversationContextService(),
    new IntentClassifierService(),
    new GoalDetectorService(),
    new AgentSelectorService(),
    new NextActionService(),
    new HandoffReadinessService(),
    qualityService,
  );
  return {
    resolver: new AssistantProfileResolverService(),
    compareService: new ConversationEngineCompareService(engine),
    responseDrafts: new ResponseDraftService(qualityService),
  };
}

async function loadState(db, siteId, tenantId) {
  const siteRes = await db.query(
    `SELECT id, tenant_id, config, allowed_domains, is_evaluation_demo
     FROM sites
     WHERE id = $1 AND tenant_id = $2`,
    [siteId, tenantId],
  );
  const site = siteRes.rows[0];
  if (!site) throw new Error('Site nicht gefunden oder Tenant-Scope ungueltig.');
  const modulesRes = await db.query(
    `SELECT module_key, is_enabled, config FROM site_modules WHERE site_id = $1`,
    [siteId],
  );
  const modules = Object.fromEntries(modulesRes.rows.map((row) => [row.module_key, row.config || {}]));
  const moduleRow = modulesRes.rows.find((row) => row.module_key === MODULE_KEY);
  const config = normalizeConfig(moduleRow?.config || {});
  return { site, modules, config, moduleEnabled: moduleRow?.is_enabled === true };
}

async function saveConfig(db, siteId, config) {
  await db.query(
    `INSERT INTO site_modules(site_id, module_key, is_enabled, config, created_at, updated_at)
     VALUES ($1, $2, true, $3::jsonb, now(), now())
     ON CONFLICT (site_id, module_key) DO UPDATE SET
       is_enabled = true,
       config = EXCLUDED.config,
       updated_at = now()`,
    [siteId, MODULE_KEY, JSON.stringify(config)],
  );
}

async function hasKnowledge(db, siteId) {
  const res = await db.query(
    `SELECT COUNT(*)::text AS count
     FROM knowledge_sources
     WHERE site_id = $1
       AND is_active IS DISTINCT FROM false
       AND sync_status = 'ready'`,
    [siteId],
  );
  return Number(res.rows[0]?.count || 0) > 0;
}

function compactResponsePreview(preview) {
  return sanitizeValue({
    enabled: preview.enabled,
    draftTextPreview: redactText(preview.draft?.text || '').slice(0, 800),
    mode: preview.draft?.mode || 'unknown',
    nextActionLabel: redactText(preview.draft?.nextActionLabel || '').slice(0, 800),
    shouldAskQuestion: preview.draft?.shouldAskQuestion === true,
    shouldHandoff: preview.draft?.shouldHandoff === true,
    missingFields: asArray(preview.draft?.missingFields).map((entry) => redactText(entry)),
    confidence: preview.draft?.confidence || 0,
    qualityStatus: preview.quality?.status || 'unknown',
    qualityScore: preview.quality?.score || 0,
    qualityFindings: asArray(preview.quality?.findings).map((entry) => redactText(entry)),
    qualityRisks: asArray(preview.quality?.risks).map((entry) => redactText(entry)),
    qualityRecommendations: asArray(preview.quality?.recommendations).map((entry) => redactText(entry)),
    warnings: asArray(preview.warnings).map((entry) => redactText(entry)),
  });
}

async function runComparisons({ db, site, modules, config, resolver, compareService, responseDrafts, includeResponsePreview }) {
  const moduleConfigs = { ...modules, [MODULE_KEY]: config };
  const assistantProfile = resolver.resolve({ siteConfig: asRecord(site.config), moduleConfigs });
  const knowledgeAvailable = await hasKnowledge(db, site.id);
  const results = [];
  for (const testCase of config.testCases) {
    const comparison = compareService.compare({
      assistantProfile,
      latestUserMessage: testCase.message,
      conversationHistory: [],
      existingConversationState: {},
      knowledgeAvailable,
      expectedIntent: testCase.expectedIntent,
      expectedGoal: testCase.expectedGoal,
      expectedAgentKey: testCase.expectedAgentKey,
      testMode: true,
    });
    const decision = comparison.engine.conversationDecision;
    const responsePreview = includeResponsePreview && config.conversationEngine.responsePreviewEnabled && responseDrafts
      ? compactResponsePreview(responseDrafts.preview({
          assistantProfile,
          decision,
          latestUserMessage: testCase.message,
          history: [],
          knowledgeAvailable,
          testMode: true,
        }))
      : undefined;
    results.push({
      id: testCase.id,
      name: testCase.name,
      message: redactText(testCase.message),
      expectedIntent: testCase.expectedIntent || '',
      expectedGoal: testCase.expectedGoal || '',
      expectedAgentKey: testCase.expectedAgentKey || '',
      engineIntent: decision.intent,
      engineGoal: decision.goal,
      engineAgent: decision.selectedAgentKey || '',
      legacyRoute: comparison.legacy.route,
      legacyUsedKnowledge: comparison.legacy.usedKnowledge,
      comparisonStatus: comparison.comparison.status,
      findings: sanitizeValue(comparison.comparison.findings),
      risks: sanitizeValue(comparison.comparison.risks),
      recommendations: sanitizeValue(comparison.comparison.recommendations),
      confidence: decision.confidence,
      missingFields: sanitizeValue(decision.missingFields),
      nextAction: redactText(decision.nextAction),
      responsePreview,
      responsePreviewSkippedReason: includeResponsePreview && !config.conversationEngine.responsePreviewEnabled
        ? 'responsePreviewEnabled=false'
        : undefined,
      profileKey: assistantProfile.profileKey,
      profileVersion: assistantProfile.profileVersion,
      legacySource: assistantProfile.legacySource,
      handoffMismatch: comparison.legacy.route === 'lead_capture' && decision.goal !== 'prepare_contact',
    });
  }
  return { assistantProfile, results };
}

function buildReport({ args, site, previousConfig, finalConfig, assistantProfile, results }) {
  const metrics = calculateEvaluationMetrics(results);
  const responseQualitySummary = calculateResponseQualitySummary(results);
  return sanitizeValue({
    generatedAt: new Date().toISOString(),
    dryRun: args.dryRun,
    site: {
      tenantId: args.tenantId,
      siteId: args.siteId,
      environment: asRecord(site.config).environment || (site.is_evaluation_demo ? 'demo' : 'unknown'),
      profileKey: assistantProfile?.profileKey || 'not-run',
      profileVersion: assistantProfile?.profileVersion || null,
      legacySource: assistantProfile?.legacySource || 'not-run',
    },
    featureFlags: finalConfig.conversationEngine,
    previousFeatureFlags: previousConfig.conversationEngine,
    summary: metrics,
    responseQualitySummary,
    patterns: summarizePatterns(results),
    criticalConflicts: results
      .filter((result) => result.comparisonStatus === 'conflict')
      .map((result) => ({
        testCase: result.name,
        legacyRoute: result.legacyRoute,
        engineIntent: result.engineIntent,
        engineGoal: result.engineGoal,
        risk: result.risks[0] || 'Konflikt zwischen Legacy und Engine.',
        recommendation: result.recommendations[0] || 'Intent-, Goal- oder Profil-Mapping prüfen.',
      })),
    criticalResponseDrafts: results
      .filter((result) => {
        const preview = asRecord(result.responsePreview);
        return preview.qualityStatus === 'risky' || Number(preview.qualityScore || 100) < 50;
      })
      .map((result) => ({
        testCase: result.name,
        qualityStatus: asRecord(result.responsePreview).qualityStatus || 'unknown',
        qualityScore: asRecord(result.responsePreview).qualityScore || 0,
        risk: asArray(asRecord(result.responsePreview).qualityRisks)[0] || 'Antwortentwurf prüfen.',
        recommendation: asArray(asRecord(result.responsePreview).qualityRecommendations)[0] || 'Antwortlogik oder Profil-Mapping prüfen.',
      })),
    results,
    nextRecommendations: [
      'Intent-Regeln fuer Konfliktfaelle gezielt erweitern.',
      'Goal-Regeln fuer Kontakt-, Wissens- und Supportfaelle pruefen.',
      'Agent-Auswahl gegen erwartete Agenten je Testfall vergleichen.',
      'AssistantProfile-Mapping fuer Legacy-Sites schrittweise haerten.',
      'Knowledge-Verfuegbarkeit im Vergleich sichtbar bewerten.',
      'Dashboard-Hinweis fuer deaktivierte oder fehlende Agenten ergaenzen.',
    ],
  });
}

function renderMarkdown(report) {
  const s = report.summary;
  const q = report.responseQualitySummary || {};
  const conflictRows = report.criticalConflicts.length
    ? report.criticalConflicts.map((item) =>
        `- ${item.testCase}: Legacy=${item.legacyRoute}, Engine=${item.engineIntent}/${item.engineGoal}. Risiko: ${item.risk} Empfehlung: ${item.recommendation}`,
      ).join('\n')
    : '- Keine kritischen Konflikte.';
  const riskyDraftRows = report.criticalResponseDrafts.length
    ? report.criticalResponseDrafts.map((item) =>
        `- ${item.testCase}: ${item.qualityStatus}, Score=${item.qualityScore}. Risiko: ${item.risk} Empfehlung: ${item.recommendation}`,
      ).join('\n')
    : '- Keine kritischen Antwortentwürfe.';
  const list = (items) => items?.length
    ? items.map((item) => `- ${item.label}: ${item.total}`).join('\n')
    : '- Keine auffaelligen Muster.';

  return `# Conversation Engine Evaluation

## Site
- tenantId: ${report.site.tenantId}
- siteId: ${report.site.siteId}
- environment: ${report.site.environment}
- profileKey: ${report.site.profileKey}
- profileVersion: ${report.site.profileVersion}
- legacySource: ${report.site.legacySource}

## Feature Flags
- previewEnabled: ${report.featureFlags.previewEnabled}
- compareEnabled: ${report.featureFlags.compareEnabled}
- adminTestOnly: ${report.featureFlags.adminTestOnly}
- responsePreviewEnabled: ${report.featureFlags.responsePreviewEnabled}

## Zusammenfassung
- totalCases: ${s.totalCases}
- aligned: ${s.alignedCount}
- partial: ${s.partialCount}
- conflict: ${s.conflictCount}
- unknown: ${s.unknownCount}
- intentAccuracy: ${s.intentAccuracy}
- goalAccuracy: ${s.goalAccuracy}
- agentAccuracy: ${s.agentAccuracy}
- localServiceBiasCount: ${s.localServiceBiasCount}

## Antwortqualität
- totalWithPreview: ${q.totalWithPreview || 0}
- good: ${q.goodCount || 0}
- needsReview: ${q.needsReviewCount || 0}
- risky: ${q.riskyCount || 0}
- unknown: ${q.unknownCount || 0}
- averageQualityScore: ${q.averageQualityScore || 0}
- lowestQualityScore: ${q.lowestQualityScore ?? 'n/a'}
- highestQualityScore: ${q.highestQualityScore ?? 'n/a'}

## Kritische Konflikte
${conflictRows}

## Kritische Antwortentwürfe
${riskyDraftRows}

## Häufigste Muster

### Falsche Intent-Erkennung
${list(report.patterns.wrongIntents)}

### Falsches Gesprächsziel
${list(report.patterns.wrongGoals)}

### Falscher Agent
${list(report.patterns.wrongAgents)}

### Unnötiger Handwerker-/Local-Service-Bias
${list(report.patterns.localServiceBias)}

### Fehlende Wissensbasis
${list(report.patterns.missingKnowledge)}

### Fehlende Übergaberegel
${list(report.patterns.missingHandoffRules)}

### Fehlende Agentenaktivierung
${list(report.patterns.missingAgents)}

## Empfohlene nächste Änderungen
${report.nextRecommendations.map((item) => `- ${item}`).join('\n')}
`;
}

async function writeReport({ report, siteId, output }) {
  await mkdir(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(REPORT_DIR, `${siteId}-${timestamp}`);
  const jsonPath = `${base}.json`;
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  let mdPath = null;
  if (output === 'markdown') {
    mdPath = `${base}.md`;
    await writeFile(mdPath, renderMarkdown(report), 'utf8');
  }
  return { jsonPath, mdPath };
}

export async function runEvaluation(args, { db, services, writeReports = true } = {}) {
  if (!args.tenantId || !args.siteId) {
    throw new Error('--tenantId und --siteId sind erforderlich.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Conversation-Engine-Evaluation darf nicht mit NODE_ENV=production ausgeführt werden.');
  }

  const ownedDb = db ? null : new Pool({ connectionString: process.env.DATABASE_URL });
  const queryable = db || {
    query: (sql, params) => ownedDb.query(sql, params),
  };

  try {
    const state = await loadState(queryable, args.siteId, args.tenantId);
    assertInternalEvaluationAllowed({
      site: state.site,
      allowInternalEvaluation: args.allowInternalEvaluation,
      nodeEnv: process.env.NODE_ENV,
    });

    let nextConfig = normalizeConfig(state.config);
    const previousConfig = normalizeConfig(state.config);
    if (args.enableFlags) nextConfig = enableFlags(nextConfig, args.includeResponsePreview);
    if (args.seedStarterCases) nextConfig = seedStarterCases(nextConfig);

    if (!args.dryRun && (args.enableFlags || args.seedStarterCases)) {
      await saveConfig(queryable, args.siteId, nextConfig);
    }

    const activeConfig = args.dryRun ? nextConfig : (await loadState(queryable, args.siteId, args.tenantId)).config;
    let assistantProfile = null;
    let results = [];
    if (args.run) {
      const loadedServices = services || await loadDistServices();
      const comparison = await runComparisons({
        db: queryable,
        site: state.site,
        modules: state.modules,
        config: activeConfig,
        resolver: loadedServices.resolver,
        compareService: loadedServices.compareService,
        responseDrafts: loadedServices.responseDrafts,
        includeResponsePreview: args.includeResponsePreview,
      });
      assistantProfile = comparison.assistantProfile;
      results = comparison.results;
      const configWithResults = {
        ...activeConfig,
        testCases: activeConfig.testCases.map((testCase) => {
          const result = results.find((entry) => entry.id === testCase.id);
          return result
            ? {
                ...testCase,
                resultStatus: result.comparisonStatus,
                lastComparison: result,
                responsePreview: result.responsePreview,
                responsePreviewSkippedReason: result.responsePreviewSkippedReason,
                lastRunAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : testCase;
        }),
        lastMetrics: calculateEvaluationMetrics(results),
      };
      if (!args.dryRun) {
        await saveConfig(queryable, args.siteId, configWithResults);
      }
      nextConfig = configWithResults;
    }

    const report = buildReport({
      args,
      site: state.site,
      previousConfig,
      finalConfig: nextConfig,
      assistantProfile,
      results,
    });
    const paths = writeReports
      ? await writeReport({ report, siteId: args.siteId, output: args.output })
      : { jsonPath: null, mdPath: null };
    return { report, paths };
  } finally {
    if (ownedDb) {
      await ownedDb.end();
    }
  }
}

async function main() {
  const args = parseArgs();
  const result = await runEvaluation(args);
  console.log(JSON.stringify({
    status: 'ok',
    summary: result.report.summary,
    report: result.paths,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.message || error?.code || error?.name || 'Evaluation failed');
    process.exitCode = 1;
  });
}
