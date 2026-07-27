import { BadRequestException, Injectable } from '@nestjs/common';
import { AssistantProfileResolverService } from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { SitesService } from '../sites/sites.service';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { EngineKnowledgeRetrievalResult } from './conversation-engine.types';
import { KnowledgePreviewRetrievalService } from './knowledge-preview-retrieval.service';
import { ResponseDraftService } from './response-draft.service';

type SiteModulePreview = {
  key: string;
  isEnabled?: boolean;
  config: Record<string, unknown>;
};

type TestCase = {
  id: string;
  name: string;
  message: string;
  expectedIntent?: string;
  expectedGoal?: string;
  expectedAgentKey?: string;
  resultStatus?: 'aligned' | 'partial' | 'conflict' | 'unknown';
  lastComparison?: Record<string, unknown>;
  responsePreview?: Record<string, unknown>;
  responsePreviewSkippedReason?: string;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

type TestModuleConfig = {
  conversationEngine: {
    previewEnabled: boolean;
    compareEnabled: boolean;
    responsePreviewEnabled: boolean;
    knowledgePreviewEnabled: boolean;
    adminTestOnly: true;
  };
  testCases: TestCase[];
  demoWorkspaceConfig?: DemoWorkspaceConfig | null;
  lastMetrics?: Record<string, unknown>;
};

const MODULE_KEY = 'conversation-engine-tests';
const DEMO_WORKSPACE_CONFIG_VERSION = 1;
const DEMO_WORKSPACE_ALLOWED_TONES = new Set(['professional', 'friendly', 'consultative', 'formal']);

type DemoWorkspaceConfig = {
  version: 1;
  assistantName: string;
  companyContext: string;
  assistantRole: string;
  targetAudience: string[];
  tone: 'professional' | 'friendly' | 'consultative' | 'formal';
  allowedTasks: string[];
  blockedTasks: string[];
  handoffAllowed: boolean;
  ticketAllowed: boolean;
  requiredFields: string[];
  metadata: {
    source: 'demo_workspace_agent_builder';
    updatedAt: string;
    updatedByRole: 'admin' | 'operator';
    customerDataAllowed: false;
    knowledgePersistenceEnabled: false;
    chatHistoryPersistenceEnabled: false;
    publicWidgetActivation: false;
    productionActivation: false;
  };
};

const DEFAULT_DEMO_WORKSPACE_CONFIG = {
  assistantName: 'Demo Workspace Agent',
  companyContext: '',
  assistantRole: 'Digitaler Demo-Assistent fuer Admin-Tests',
  targetAudience: [] as string[],
  tone: 'professional' as const,
  allowedTasks: ['answer_questions', 'collect_requests', 'triage_support', 'prepare_handoff'],
  blockedTasks: [] as string[],
  handoffAllowed: true,
  ticketAllowed: false,
  requiredFields: ['fullName', 'email', 'description'],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function dedupeTrimmedStrings(entries: unknown, limit: number) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      continue;
    }
    const normalized = entry.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized.slice(0, 160));
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

function sanitizeStoredText(value: unknown, fallback: string) {
  const text = asString(value).slice(0, 500);
  const sanitized = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[E-MAIL]')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '[TELEFON]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]+)\b/g, '[SECRET]');
  return sanitized || fallback;
}

function sanitizePreviewText(value: unknown, fallback = '') {
  return sanitizeStoredText(value, fallback).slice(0, 800);
}

function normalizeDemoWorkspaceConfig(value: unknown): DemoWorkspaceConfig | null {
  const source = asRecord(value);
  if (Object.keys(source).length === 0) {
    return null;
  }

  const metadata = asRecord(source.metadata);
  const tone = asString(source.tone);
  const updatedByRole = asString(metadata.updatedByRole) === 'admin' ? 'admin' : 'operator';
  const updatedAt = asString(metadata.updatedAt) || new Date().toISOString();

  return {
    version: DEMO_WORKSPACE_CONFIG_VERSION,
    assistantName: sanitizeStoredText(source.assistantName, DEFAULT_DEMO_WORKSPACE_CONFIG.assistantName).slice(0, 120),
    companyContext: sanitizeStoredText(source.companyContext, DEFAULT_DEMO_WORKSPACE_CONFIG.companyContext).slice(0, 1200),
    assistantRole: sanitizeStoredText(source.assistantRole, DEFAULT_DEMO_WORKSPACE_CONFIG.assistantRole).slice(0, 160),
    targetAudience: dedupeTrimmedStrings(source.targetAudience, 8),
    tone: DEMO_WORKSPACE_ALLOWED_TONES.has(tone)
      ? tone as DemoWorkspaceConfig['tone']
      : DEFAULT_DEMO_WORKSPACE_CONFIG.tone,
    allowedTasks: dedupeTrimmedStrings(source.allowedTasks, 16),
    blockedTasks: dedupeTrimmedStrings(source.blockedTasks, 16),
    handoffAllowed: asBoolean(source.handoffAllowed, DEFAULT_DEMO_WORKSPACE_CONFIG.handoffAllowed),
    ticketAllowed: asBoolean(source.ticketAllowed, DEFAULT_DEMO_WORKSPACE_CONFIG.ticketAllowed),
    requiredFields: dedupeTrimmedStrings(source.requiredFields, 8),
    metadata: {
      source: 'demo_workspace_agent_builder',
      updatedAt,
      updatedByRole,
      customerDataAllowed: false,
      knowledgePersistenceEnabled: false,
      chatHistoryPersistenceEnabled: false,
      publicWidgetActivation: false,
      productionActivation: false,
    },
  };
}

function sanitizeDemoWorkspaceConfig(
  value: unknown,
  actorRole: string,
): DemoWorkspaceConfig {
  const source = asRecord(value);
  const updatedByRole = actorRole === 'admin' ? 'admin' : 'operator';

  return {
    version: DEMO_WORKSPACE_CONFIG_VERSION,
    assistantName: sanitizeStoredText(source.assistantName, DEFAULT_DEMO_WORKSPACE_CONFIG.assistantName).slice(0, 120),
    companyContext: sanitizeStoredText(source.companyContext, DEFAULT_DEMO_WORKSPACE_CONFIG.companyContext).slice(0, 1200),
    assistantRole: sanitizeStoredText(source.assistantRole, DEFAULT_DEMO_WORKSPACE_CONFIG.assistantRole).slice(0, 160),
    targetAudience: dedupeTrimmedStrings(source.targetAudience, 8),
    tone: DEMO_WORKSPACE_ALLOWED_TONES.has(asString(source.tone))
      ? asString(source.tone) as DemoWorkspaceConfig['tone']
      : DEFAULT_DEMO_WORKSPACE_CONFIG.tone,
    allowedTasks: dedupeTrimmedStrings(source.allowedTasks, 16),
    blockedTasks: dedupeTrimmedStrings(source.blockedTasks, 16),
    handoffAllowed: asBoolean(source.handoffAllowed, DEFAULT_DEMO_WORKSPACE_CONFIG.handoffAllowed),
    ticketAllowed: asBoolean(source.ticketAllowed, DEFAULT_DEMO_WORKSPACE_CONFIG.ticketAllowed),
    requiredFields: dedupeTrimmedStrings(source.requiredFields, 8),
    metadata: {
      source: 'demo_workspace_agent_builder',
      updatedAt: new Date().toISOString(),
      updatedByRole,
      customerDataAllowed: false,
      knowledgePersistenceEnabled: false,
      chatHistoryPersistenceEnabled: false,
      publicWidgetActivation: false,
      productionActivation: false,
    },
  };
}

function normalizeTestCase(value: unknown): TestCase | null {
  const source = asRecord(value);
  const id = asString(source.id);
  const message = sanitizeStoredText(source.message, '');
  if (!id || !message) {
    return null;
  }

  const now = new Date().toISOString();
  const resultStatus = ['aligned', 'partial', 'conflict', 'unknown'].includes(asString(source.resultStatus))
    ? asString(source.resultStatus) as TestCase['resultStatus']
    : undefined;
  const responsePreview = asRecord(source.responsePreview);

  return {
    id,
    name: sanitizeStoredText(source.name, 'Testfall'),
    message,
    expectedIntent: asString(source.expectedIntent) || undefined,
    expectedGoal: asString(source.expectedGoal) || undefined,
    expectedAgentKey: asString(source.expectedAgentKey) || undefined,
    resultStatus,
    lastComparison: asRecord(source.lastComparison),
    responsePreview: Object.keys(responsePreview).length > 0 ? responsePreview : undefined,
    responsePreviewSkippedReason: asString(source.responsePreviewSkippedReason) || undefined,
    lastRunAt: asString(source.lastRunAt) || undefined,
    createdAt: asString(source.createdAt) || now,
    updatedAt: asString(source.updatedAt) || now,
  };
}

function normalizeConfig(config: Record<string, unknown> | null | undefined): TestModuleConfig {
  const source = asRecord(config);
  const engine = asRecord(source.conversationEngine);
  return {
    conversationEngine: {
      previewEnabled: asBoolean(engine.previewEnabled, false),
      compareEnabled: asBoolean(engine.compareEnabled, false),
      responsePreviewEnabled: asBoolean(engine.responsePreviewEnabled, false),
      knowledgePreviewEnabled: asBoolean(engine.knowledgePreviewEnabled, false),
      adminTestOnly: true,
    },
    testCases: Array.isArray(source.testCases)
      ? source.testCases.map(normalizeTestCase).filter((entry): entry is TestCase => entry !== null)
      : [],
    demoWorkspaceConfig: normalizeDemoWorkspaceConfig(source.demoWorkspaceConfig),
    lastMetrics: asRecord(source.lastMetrics),
  };
}

function metricsFor(results: TestCase[]) {
  const counts = {
    total: results.length,
    aligned: 0,
    partial: 0,
    conflict: 0,
    unknown: 0,
  };
  const conflictReasons = new Map<string, number>();
  const intents = new Map<string, number>();
  const agents = new Map<string, number>();
  const recommendations = new Map<string, number>();

  for (const testCase of results) {
    const status = testCase.resultStatus || 'unknown';
    counts[status] += 1;
    const comparison = asRecord(testCase.lastComparison);
    const engine = asRecord(asRecord(comparison.engine).conversationDecision);
    const resultComparison = asRecord(comparison.comparison);
    const findings = Array.isArray(resultComparison.findings) ? resultComparison.findings : [];
    const recs = Array.isArray(resultComparison.recommendations) ? resultComparison.recommendations : [];

    if (status === 'conflict') {
      for (const finding of findings) {
        if (typeof finding === 'string' && finding.trim()) {
          conflictReasons.set(finding, (conflictReasons.get(finding) || 0) + 1);
        }
      }
    }
    const intent = asString(engine.intent);
    const agent = asString(engine.selectedAgentKey);
    if (intent) intents.set(intent, (intents.get(intent) || 0) + 1);
    if (agent) agents.set(agent, (agents.get(agent) || 0) + 1);
    for (const rec of recs) {
      if (typeof rec === 'string' && rec.trim()) {
        recommendations.set(rec, (recommendations.get(rec) || 0) + 1);
      }
    }
  }

  const top = (entries: Map<string, number>) =>
    Array.from(entries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

  return {
    ...counts,
    topConflictReasons: top(conflictReasons),
    affectedIntents: top(intents),
    affectedAgents: top(agents),
    recommendations: top(recommendations),
  };
}

function responseQualitySummaryFor(results: TestCase[]) {
  const summary = {
    totalWithPreview: 0,
    goodCount: 0,
    needsReviewCount: 0,
    riskyCount: 0,
    unknownCount: 0,
    averageQualityScore: 0,
    lowestQualityScore: null as number | null,
    highestQualityScore: null as number | null,
    riskyTestCaseNames: [] as string[],
    commonRisks: [] as Array<{ label: string; count: number }>,
    commonRecommendations: [] as Array<{ label: string; count: number }>,
  };
  const riskCounts = new Map<string, number>();
  const recommendationCounts = new Map<string, number>();
  const scores: number[] = [];

  for (const testCase of results) {
    const preview = asRecord(testCase.responsePreview);
    if (Object.keys(preview).length === 0) continue;
    summary.totalWithPreview += 1;
    const status = asString(preview.qualityStatus) || 'unknown';
    const score = Number(preview.qualityScore);
    if (Number.isFinite(score)) scores.push(score);
    if (status === 'good') summary.goodCount += 1;
    else if (status === 'needs_review') summary.needsReviewCount += 1;
    else if (status === 'risky') {
      summary.riskyCount += 1;
      summary.riskyTestCaseNames.push(testCase.name);
    } else summary.unknownCount += 1;

    const risks = Array.isArray(preview.qualityRisks) ? preview.qualityRisks : [];
    const recommendations = Array.isArray(preview.qualityRecommendations) ? preview.qualityRecommendations : [];
    for (const risk of risks) {
      if (typeof risk === 'string' && risk.trim()) riskCounts.set(risk, (riskCounts.get(risk) || 0) + 1);
    }
    for (const recommendation of recommendations) {
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
  const top = (entries: Map<string, number>) =>
    Array.from(entries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));
  summary.commonRisks = top(riskCounts);
  summary.commonRecommendations = top(recommendationCounts);
  return summary;
}

function knowledgeSummaryFor(results: TestCase[]) {
  const summary = {
    totalAttempted: 0,
    groundedCount: 0,
    partiallyGroundedCount: 0,
    ungroundedCount: 0,
    noKnowledgeNeededCount: 0,
    emptyKnowledgeCount: 0,
    retrievalErrorCount: 0,
    commonGroundingWarnings: [] as Array<{ label: string; count: number }>,
  };
  const warnings = new Map<string, number>();

  for (const testCase of results) {
    const preview = asRecord(testCase.responsePreview);
    const groundingStatus = asString(preview.groundingStatus);
    if (preview.knowledgeAttempted === true) summary.totalAttempted += 1;
    if (groundingStatus === 'grounded') summary.groundedCount += 1;
    else if (groundingStatus === 'partially_grounded') summary.partiallyGroundedCount += 1;
    else if (groundingStatus === 'ungrounded') summary.ungroundedCount += 1;
    else if (groundingStatus === 'not_required') summary.noKnowledgeNeededCount += 1;
    if (preview.knowledgeStatus === 'empty') summary.emptyKnowledgeCount += 1;
    if (preview.knowledgeStatus === 'error') summary.retrievalErrorCount += 1;
    const groundingWarnings = Array.isArray(preview.groundingWarnings) ? preview.groundingWarnings : [];
    for (const warning of groundingWarnings) {
      if (typeof warning === 'string' && warning.trim()) {
        warnings.set(warning, (warnings.get(warning) || 0) + 1);
      }
    }
  }

  summary.commonGroundingWarnings = Array.from(warnings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
  return summary;
}

@Injectable()
export class ConversationEngineTestCasesService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly resolver: AssistantProfileResolverService,
    private readonly compareService: ConversationEngineCompareService,
    private readonly knowledgePreview: KnowledgePreviewRetrievalService,
    private readonly responseDrafts: ResponseDraftService,
  ) {}

  async getState(siteId: string) {
    const config = await this.loadConfig(siteId);
    return {
      settings: config.conversationEngine,
      testCases: config.testCases,
      metrics: config.lastMetrics && Object.keys(config.lastMetrics).length > 0
        ? config.lastMetrics
        : metricsFor(config.testCases),
      responseQualitySummary: responseQualitySummaryFor(config.testCases),
      knowledgeSummary: knowledgeSummaryFor(config.testCases),
      starterTestCases: this.starterTestCases(),
    };
  }

  async getDemoWorkspaceConfig(siteId: string) {
    const config = await this.loadConfig(siteId);
    return {
      hasSavedConfig: config.demoWorkspaceConfig !== null,
      savedConfig: config.demoWorkspaceConfig,
    };
  }

  async updateDemoWorkspaceConfig(siteId: string, input: Record<string, unknown>, actorRole: string) {
    const config = await this.loadConfig(siteId);
    config.demoWorkspaceConfig = sanitizeDemoWorkspaceConfig(input, actorRole);
    await this.saveConfig(siteId, config);
    return {
      saved: true,
      savedConfig: config.demoWorkspaceConfig,
      hasSavedConfig: true,
    };
  }

  async deleteDemoWorkspaceConfig(siteId: string) {
    const config = await this.loadConfig(siteId);
    const hadSavedConfig = config.demoWorkspaceConfig !== null;
    delete config.demoWorkspaceConfig;
    await this.saveConfig(siteId, config);
    return {
      deleted: true,
      hadSavedConfig,
      hasSavedConfig: false,
      savedConfig: null,
    };
  }

  async updateSettings(siteId: string, input: Record<string, unknown>) {
    const config = await this.loadConfig(siteId);
    config.conversationEngine = {
      previewEnabled: asBoolean(input.previewEnabled, config.conversationEngine.previewEnabled),
      compareEnabled: asBoolean(input.compareEnabled, config.conversationEngine.compareEnabled),
      responsePreviewEnabled: asBoolean(input.responsePreviewEnabled, config.conversationEngine.responsePreviewEnabled),
      knowledgePreviewEnabled: asBoolean(input.knowledgePreviewEnabled, config.conversationEngine.knowledgePreviewEnabled),
      adminTestOnly: true,
    };
    await this.saveConfig(siteId, config);
    return this.getState(siteId);
  }

  async createTestCase(siteId: string, input: Record<string, unknown>) {
    const config = await this.loadConfig(siteId);
    const now = new Date().toISOString();
    const testCase: TestCase = {
      id: `case_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: sanitizeStoredText(input.name, 'Neuer Testfall'),
      message: sanitizeStoredText(input.message, ''),
      expectedIntent: asString(input.expectedIntent) || undefined,
      expectedGoal: asString(input.expectedGoal) || undefined,
      expectedAgentKey: asString(input.expectedAgentKey) || undefined,
      createdAt: now,
      updatedAt: now,
    };
    if (!testCase.message) {
      throw new BadRequestException('Testnachricht fehlt.');
    }
    config.testCases = [...config.testCases, testCase].slice(0, 50);
    await this.saveConfig(siteId, config);
    return this.getState(siteId);
  }

  async updateTestCase(siteId: string, caseId: string, input: Record<string, unknown>) {
    const config = await this.loadConfig(siteId);
    const index = config.testCases.findIndex((testCase) => testCase.id === caseId);
    if (index < 0) {
      throw new BadRequestException('Testfall nicht gefunden.');
    }
    config.testCases[index] = {
      ...config.testCases[index],
      name: input.name !== undefined ? sanitizeStoredText(input.name, config.testCases[index].name) : config.testCases[index].name,
      message: input.message !== undefined ? sanitizeStoredText(input.message, config.testCases[index].message) : config.testCases[index].message,
      expectedIntent: input.expectedIntent !== undefined ? asString(input.expectedIntent) || undefined : config.testCases[index].expectedIntent,
      expectedGoal: input.expectedGoal !== undefined ? asString(input.expectedGoal) || undefined : config.testCases[index].expectedGoal,
      expectedAgentKey: input.expectedAgentKey !== undefined ? asString(input.expectedAgentKey) || undefined : config.testCases[index].expectedAgentKey,
      updatedAt: new Date().toISOString(),
    };
    await this.saveConfig(siteId, config);
    return this.getState(siteId);
  }

  async deleteTestCase(siteId: string, caseId: string) {
    const config = await this.loadConfig(siteId);
    config.testCases = config.testCases.filter((testCase) => testCase.id !== caseId);
    config.lastMetrics = metricsFor(config.testCases);
    await this.saveConfig(siteId, config);
    return this.getState(siteId);
  }

  async runTestCases(siteId: string, input: Record<string, unknown>) {
    const config = await this.loadConfig(siteId);
    if (!config.conversationEngine.previewEnabled || !config.conversationEngine.compareEnabled) {
      throw new BadRequestException('Gesprächslogik-Vergleich ist für diese Site deaktiviert.');
    }

    const selectedIds = Array.isArray(input.caseIds)
      ? new Set(input.caseIds.filter((entry): entry is string => typeof entry === 'string'))
      : null;
    const includeResponsePreview = input.includeResponsePreview === true;
    const includeKnowledge = input.includeKnowledge === true;
    const site = await this.sites.getSite(siteId);
    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));
    const assistantProfile = this.resolver.resolve({ siteConfig: asRecord(site?.config), moduleConfigs });
    const knowledgeAvailable = await this.hasKnowledge(siteId);
    const now = new Date().toISOString();

    const nextCases: TestCase[] = [];
    for (const testCase of config.testCases) {
      if (selectedIds && !selectedIds.has(testCase.id)) {
        nextCases.push(testCase);
        continue;
      }
      const comparison = this.compareService.compare({
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
      const knowledgeRetrieval = includeKnowledge && config.conversationEngine.knowledgePreviewEnabled
        ? await this.knowledgePreview.retrieve({
            tenantId: site?.tenant_id || '',
            siteId,
            assistantProfile,
            conversationDecision: comparison.engine.conversationDecision,
            latestUserMessage: testCase.message,
            history: [],
            selectedAgentKey: comparison.engine.conversationDecision.selectedAgentKey,
            knowledgeMode: assistantProfile.knowledgeMode,
            enabled: true,
          })
        : {
            enabled: false,
            attempted: false,
            status: 'disabled',
            snippets: [],
            warnings: [],
            reasons: ['Wissensbasis-Vorschau ist deaktiviert.'],
          } satisfies EngineKnowledgeRetrievalResult;
      const responsePreview = includeResponsePreview && config.conversationEngine.responsePreviewEnabled
        ? this.buildResponsePreview({
            assistantProfile,
            decision: comparison.engine.conversationDecision,
            message: testCase.message,
            knowledgeAvailable,
            knowledgeRetrieval,
          })
        : undefined;
      nextCases.push({
        ...testCase,
        resultStatus: comparison.comparison.status,
        lastComparison: comparison,
        responsePreview,
        responsePreviewSkippedReason: includeResponsePreview && !config.conversationEngine.responsePreviewEnabled
          ? 'responsePreviewEnabled=false'
          : includeKnowledge && !config.conversationEngine.knowledgePreviewEnabled
            ? 'knowledgePreviewEnabled=false'
          : undefined,
        lastRunAt: now,
        updatedAt: now,
      });
    }
    config.testCases = nextCases;
    config.lastMetrics = metricsFor(config.testCases);
    await this.saveConfig(siteId, config);
    return this.getState(siteId);
  }

  private buildResponsePreview(input: {
    assistantProfile: ReturnType<AssistantProfileResolverService['resolve']>;
    decision: ReturnType<ConversationEngineCompareService['compare']>['engine']['conversationDecision'];
    message: string;
    knowledgeAvailable: boolean;
    knowledgeRetrieval: EngineKnowledgeRetrievalResult;
  }) {
    const preview = this.responseDrafts.preview({
      assistantProfile: input.assistantProfile,
      decision: input.decision,
      latestUserMessage: input.message,
      history: [],
      knowledgeAvailable: input.knowledgeAvailable,
      knowledgeRetrievalResult: input.knowledgeRetrieval,
      testMode: true,
    });
    return {
      enabled: preview.enabled,
      draftTextPreview: sanitizePreviewText(preview.draft?.text || ''),
      mode: preview.draft?.mode || 'unknown',
      nextActionLabel: sanitizePreviewText(preview.draft?.nextActionLabel || ''),
      shouldAskQuestion: preview.draft?.shouldAskQuestion === true,
      shouldHandoff: preview.draft?.shouldHandoff === true,
      missingFields: Array.isArray(preview.draft?.missingFields) ? preview.draft.missingFields.map((field) => sanitizePreviewText(field)) : [],
      confidence: preview.draft?.confidence || 0,
      qualityStatus: preview.quality?.status || 'unknown',
      qualityScore: preview.quality?.score || 0,
      qualityFindings: (preview.quality?.findings || []).map((entry) => sanitizePreviewText(entry)),
      qualityRisks: (preview.quality?.risks || []).map((entry) => sanitizePreviewText(entry)),
      qualityRecommendations: (preview.quality?.recommendations || []).map((entry) => sanitizePreviewText(entry)),
      groundingStatus: preview.draft?.groundingStatus || 'not_required',
      groundingWarnings: (preview.draft?.groundingWarnings || []).map((entry) => sanitizePreviewText(entry)),
      usedKnowledgeSources: (preview.draft?.usedKnowledgeSources || []).map((source) => ({
        id: sanitizePreviewText(source.id || ''),
        title: sanitizePreviewText(source.title || ''),
        sourceType: sanitizePreviewText(source.sourceType || ''),
        score: source.score,
        excerpt: sanitizePreviewText(source.excerpt || ''),
      })),
      knowledgeAttempted: input.knowledgeRetrieval.attempted,
      knowledgeStatus: input.knowledgeRetrieval.status,
      warnings: preview.warnings.map((entry) => sanitizePreviewText(entry)),
    };
  }

  starterTestCases() {
    return [
      { name: 'IT-Support', message: 'Ich brauche Hilfe, mein VPN funktioniert nicht.' },
      { name: 'Kostenfrage', message: 'Was kostet das?' },
      { name: 'Terminwunsch', message: 'Ich möchte einen Termin vereinbaren.' },
      { name: 'Angebot', message: 'Können Sie mir dazu ein Angebot machen?' },
      { name: 'Leistungen', message: 'Welche Leistungen bieten Sie an?' },
      { name: 'Unklarer Bedarf', message: 'Ich weiß nicht genau, was ich brauche.' },
    ];
  }

  private async loadConfig(siteId: string): Promise<TestModuleConfig> {
    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const module = modules.find((entry) => entry.key === MODULE_KEY);
    return normalizeConfig(module?.config || {});
  }

  private async saveConfig(siteId: string, config: TestModuleConfig) {
    await this.siteModules.updateForSite(siteId, [
      {
        key: MODULE_KEY,
        isEnabled: true,
        config,
      },
    ]);
  }

  private async hasKnowledge(siteId: string) {
    const res = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM knowledge_sources
       WHERE site_id = $1
         AND is_active IS DISTINCT FROM false
         AND sync_status = 'ready'`,
      [siteId],
    );
    return Number(res.rows[0]?.count || 0) > 0;
  }
}
