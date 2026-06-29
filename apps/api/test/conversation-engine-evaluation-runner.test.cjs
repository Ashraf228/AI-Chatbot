const test = require('node:test');
const assert = require('node:assert/strict');

async function loadRunner() {
  return import('../../../scripts/evaluation/conversation-engine-evaluation.mjs');
}

function createDb({ siteConfig = { environment: 'demo' }, allowedDomains = ['demo.example.test'] } = {}) {
  const state = {
    config: {
      conversationEngine: { previewEnabled: false, compareEnabled: false, adminTestOnly: true },
      testCases: [],
    },
    writes: [],
    queries: [],
    siteConfig,
    allowedDomains,
  };
  return {
    state,
    async query(sql, params = []) {
      const compact = sql.replace(/\s+/g, ' ').trim();
      state.queries.push(compact);
      if (/FROM sites WHERE id = \$1 AND tenant_id = \$2/i.test(compact)) {
        return {
          rows: [{
            id: params[0],
            tenant_id: params[1],
            config: state.siteConfig,
            allowed_domains: state.allowedDomains,
            is_evaluation_demo: state.siteConfig.environment === 'demo',
          }],
        };
      }
      if (/FROM site_modules WHERE site_id = \$1/i.test(compact)) {
        return {
          rows: [{
            module_key: 'conversation-engine-tests',
            is_enabled: true,
            config: state.config,
          }],
        };
      }
      if (/INSERT INTO site_modules/i.test(compact)) {
        state.writes.push({ sql: compact, params });
        state.config = JSON.parse(params[2]);
        return { rows: [] };
      }
      if (/FROM knowledge_sources/i.test(compact)) {
        return { rows: [{ count: '1' }] };
      }
      return { rows: [] };
    },
  };
}

function createServices() {
  return {
    resolver: {
      resolve() {
        return {
          profileKey: 'local-service-first-contact',
          profileVersion: 1,
          legacySource: 'test',
          enabledTasks: ['local_service_intake', 'triage_support', 'answer_questions'],
          enabledAgents: ['support-agent', 'knowledge-agent'],
          requiredFields: [],
          handoffRules: { enabled: true },
          deliveryChannels: {},
          conversationEngine: {},
          agents: [],
        };
      },
    },
    compareService: {
      compare(input) {
        const support = /VPN/i.test(input.latestUserMessage);
        return {
          legacy: {
            replyPreview: 'Dry-run',
            route: support ? 'local_service_intake' : 'knowledge',
            usedKnowledge: !support,
            wouldCreateLead: false,
            wouldCreateTicket: false,
            wouldTriggerIntegration: false,
            warnings: [],
          },
          engine: {
            conversationDecision: {
              intent: support ? 'support' : 'question',
              goal: support ? 'solve_problem' : 'answer_from_knowledge',
              selectedAgentKey: support ? 'support-agent' : 'knowledge-agent',
              nextAction: 'testen',
              confidence: 0.8,
              missingFields: [],
            },
          },
          comparison: {
            status: support ? 'conflict' : 'aligned',
            findings: support ? ['Legacy bias'] : [],
            risks: support ? ['Local-Service-Bias'] : [],
            recommendations: support ? ['Mapping prüfen'] : [],
          },
        };
      },
    },
    responseDrafts: {
      preview(input) {
        const support = /VPN/i.test(input.latestUserMessage);
        const snippets = input.knowledgeRetrievalResult?.snippets || [];
        return {
          enabled: true,
          draft: {
            text: support
              ? snippets.length > 0
                ? `Aus ${snippets[0].title} geht hervor: ${snippets[0].excerpt}`
                : 'Verstanden, das klingt nach einem Supportfall. Welche Fehlermeldung sehen Sie?'
              : 'Ich würde die Antwort aus der freigegebenen Wissensbasis ableiten.',
            mode: support ? 'support_guidance' : 'knowledge_answer',
            nextActionLabel: support ? 'Supportproblem eingrenzen' : 'Wissensantwort formulieren',
            shouldAskQuestion: support,
            shouldHandoff: false,
            missingFields: [],
            usedKnowledgeSources: snippets,
            groundingStatus: snippets.length > 0 ? 'grounded' : 'not_required',
            groundingWarnings: [],
            confidence: 0.8,
          },
          knowledgeRetrieval: input.knowledgeRetrievalResult,
          quality: {
            status: 'good',
            score: support ? 90 : 85,
            findings: ['Testentwurf plausibel'],
            risks: [],
            recommendations: [],
          },
          warnings: [],
        };
      },
    },
    knowledgePreview: {
      async retrieve(input) {
        return {
          enabled: true,
          attempted: true,
          status: 'available',
          snippets: [{
            id: 'snippet-1',
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            sourceId: 'source-1',
            title: 'VPN Hilfe',
            sourceType: 'faq',
            score: 0.91,
            excerpt: 'VPN-Probleme sollen zuerst anhand der Fehlermeldung eingegrenzt werden.',
            scope: 'site',
          }],
          warnings: [],
          reasons: [`read-only ${input.siteId}`],
        };
      },
    },
  };
}

test('conversation evaluation runner rejects production NODE_ENV', async () => {
  const { runEvaluation } = await loadRunner();
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(
      () => runEvaluation({ tenantId: 'tenant-1', siteId: 'site-1', dryRun: true }, { db: createDb(), services: createServices(), writeReports: false }),
      /NODE_ENV=production/,
    );
  } finally {
    process.env.NODE_ENV = previous;
  }
});

test('conversation evaluation runner rejects productive-looking sites', async () => {
  const { runEvaluation } = await loadRunner();
  await assert.rejects(
    () => runEvaluation(
      { tenantId: 'tenant-1', siteId: 'site-1', dryRun: true },
      { db: createDb({ siteConfig: { environment: 'production' }, allowedDomains: ['kunde.example.com'] }), services: createServices(), writeReports: false },
    ),
    /nicht als interne Test-\/Demo-Site/,
  );
});

test('conversation evaluation runner enables flags and seeds starter cases idempotently for one site', async () => {
  const { runEvaluation } = await loadRunner();
  const db = createDb();
  const args = {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    enableFlags: true,
    seedStarterCases: true,
    dryRun: false,
    output: 'json',
  };

  await runEvaluation(args, { db, services: createServices(), writeReports: false });
  await runEvaluation(args, { db, services: createServices(), writeReports: false });

  assert.equal(db.state.config.conversationEngine.previewEnabled, true);
  assert.equal(db.state.config.conversationEngine.compareEnabled, true);
  assert.equal(db.state.config.conversationEngine.adminTestOnly, true);
  assert.equal(db.state.config.testCases.length, 8);
  assert.equal(db.state.writes.every((write) => /conversation-engine-tests/i.test(write.params[1])), true);
});

test('conversation evaluation runner run creates sanitized report metrics without productive side effects', async () => {
  const { runEvaluation } = await loadRunner();
  const db = createDb();

  const result = await runEvaluation(
    {
      tenantId: 'tenant-1',
      siteId: 'site-1',
      enableFlags: true,
      seedStarterCases: true,
      run: true,
      dryRun: false,
      output: 'markdown',
    },
    { db, services: createServices(), writeReports: false },
  );

  assert.equal(result.report.summary.totalCases, 8);
  assert.equal(result.report.summary.conflictCount >= 1, true);
  assert.equal(result.report.summary.localServiceBiasCount >= 1, true);
  assert.equal(result.report.summary.intentAccuracy > 0, true);
  assert.doesNotMatch(JSON.stringify(result.report), /test@example\.com|017600000000|sk-/i);
  assert.equal(db.state.queries.some((sql) => /\b(widget_leads|email_jobs|webhook_jobs|agent_tickets|conversations)\b/i.test(sql)), false);
});

test('conversation evaluation runner includes response previews when requested', async () => {
  const { parseArgs, runEvaluation } = await loadRunner();
  const db = createDb();
  const args = {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    enableFlags: true,
    seedStarterCases: true,
    includeResponsePreview: true,
    run: true,
    dryRun: false,
    output: 'markdown',
  };

  assert.equal(parseArgs(['--include-response-preview']).includeResponsePreview, true);
  const result = await runEvaluation(args, { db, services: createServices(), writeReports: false });

  assert.equal(db.state.config.conversationEngine.responsePreviewEnabled, true);
  assert.equal(result.report.responseQualitySummary.totalWithPreview, 8);
  assert.equal(result.report.responseQualitySummary.goodCount, 8);
  assert.equal(result.report.responseQualitySummary.averageQualityScore > 0, true);
  assert.ok(result.report.results.every((entry) => entry.responsePreview?.draftTextPreview));
  assert.doesNotMatch(JSON.stringify(result.report), /test@example\.com|017600000000|sk-/i);
});

test('conversation evaluation runner includes knowledge grounding when requested', async () => {
  const { parseArgs, runEvaluation } = await loadRunner();
  const db = createDb();
  const args = {
    tenantId: 'tenant-1',
    siteId: 'site-1',
    enableFlags: true,
    seedStarterCases: true,
    includeResponsePreview: true,
    includeKnowledgePreview: true,
    run: true,
    dryRun: true,
    output: 'markdown',
  };

  assert.equal(parseArgs(['--include-knowledge-preview']).includeKnowledgePreview, true);
  const result = await runEvaluation(args, { db, services: createServices(), writeReports: false });

  assert.notEqual(db.state.config.conversationEngine.knowledgePreviewEnabled, true);
  assert.equal(result.report.featureFlags.knowledgePreviewEnabled, true);
  assert.equal(result.report.knowledgeGroundingSummary.totalAttempted, 8);
  assert.equal(result.report.knowledgeGroundingSummary.groundedCount, 8);
  assert.ok(result.report.results.every((entry) => entry.responsePreview?.usedKnowledgeSources?.length === 1));
  assert.doesNotMatch(JSON.stringify(result.report), /test@example\.com|017600000000|sk-/i);
  assert.equal(db.state.writes.length, 0);
});

test('conversation evaluation metrics count local-service bias', async () => {
  const { calculateEvaluationMetrics } = await loadRunner();
  const metrics = calculateEvaluationMetrics([
    {
      expectedIntent: 'support',
      expectedGoal: 'solve_problem',
      expectedAgentKey: 'support-agent',
      engineIntent: 'support',
      engineGoal: 'solve_problem',
      engineAgent: 'support-agent',
      legacyRoute: 'local_service_intake',
      comparisonStatus: 'conflict',
      profileKey: 'local-service-first-contact',
    },
  ]);

  assert.equal(metrics.intentAccuracy, 1);
  assert.equal(metrics.goalAccuracy, 1);
  assert.equal(metrics.agentAccuracy, 1);
  assert.equal(metrics.localServiceBiasCount, 1);
});
