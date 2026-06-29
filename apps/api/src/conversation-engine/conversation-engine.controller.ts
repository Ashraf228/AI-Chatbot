import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AssistantProfileDiagnosticsService, AssistantProfileResolverService } from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { SitesService } from '../sites/sites.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationEngineTestCasesService } from './conversation-engine-test-cases.service';
import { ConversationHistoryEntry } from './conversation-engine.types';
import { KnowledgePreviewRetrievalService } from './knowledge-preview-retrieval.service';
import { ResponseDraftService } from './response-draft.service';

type SiteModulePreview = {
  key: string;
  config: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function featureEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  const siteEngine = asRecord(siteConfig.conversationEngine);
  const assistantModule = asRecord(moduleConfigs['assistant-profile']);
  const moduleEngine = asRecord(assistantModule.conversationEngine);
  const testsModule = asRecord(moduleConfigs['conversation-engine-tests']);
  const testsEngine = asRecord(testsModule.conversationEngine);
  return siteEngine.previewEnabled === true || moduleEngine.previewEnabled === true || testsEngine.previewEnabled === true;
}

function compareEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  const siteEngine = asRecord(siteConfig.conversationEngine);
  const assistantModule = asRecord(moduleConfigs['assistant-profile']);
  const moduleEngine = asRecord(assistantModule.conversationEngine);
  const testsModule = asRecord(moduleConfigs['conversation-engine-tests']);
  const testsEngine = asRecord(testsModule.conversationEngine);
  return featureEnabled(siteConfig, moduleConfigs) &&
    (siteEngine.compareEnabled === true || moduleEngine.compareEnabled === true || testsEngine.compareEnabled === true);
}

function responsePreviewEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  const siteEngine = asRecord(siteConfig.conversationEngine);
  const assistantModule = asRecord(moduleConfigs['assistant-profile']);
  const moduleEngine = asRecord(assistantModule.conversationEngine);
  const testsModule = asRecord(moduleConfigs['conversation-engine-tests']);
  const testsEngine = asRecord(testsModule.conversationEngine);
  return featureEnabled(siteConfig, moduleConfigs) &&
    (siteEngine.responsePreviewEnabled === true ||
      moduleEngine.responsePreviewEnabled === true ||
      testsEngine.responsePreviewEnabled === true);
}

function knowledgePreviewEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  const siteEngine = asRecord(siteConfig.conversationEngine);
  const assistantModule = asRecord(moduleConfigs['assistant-profile']);
  const moduleEngine = asRecord(assistantModule.conversationEngine);
  const testsModule = asRecord(moduleConfigs['conversation-engine-tests']);
  const testsEngine = asRecord(testsModule.conversationEngine);
  return responsePreviewEnabled(siteConfig, moduleConfigs) &&
    (siteEngine.knowledgePreviewEnabled === true ||
      moduleEngine.knowledgePreviewEnabled === true ||
      testsEngine.knowledgePreviewEnabled === true) &&
    (siteEngine.adminTestOnly === true || moduleEngine.adminTestOnly === true || testsEngine.adminTestOnly === true);
}

function sanitizeHistory(value: unknown): ConversationHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    .map((entry) => {
      const role: ConversationHistoryEntry['role'] =
        entry.role === 'assistant' || entry.role === 'system' ? entry.role : 'user';
      return {
        role,
        content: typeof entry.content === 'string'
          ? entry.content.slice(0, 500)
          : typeof entry.text === 'string'
            ? entry.text.slice(0, 500)
            : '',
      };
    })
    .filter((entry) => entry.content.trim().length > 0)
    .slice(-12);
}

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/conversation-engine')
export class ConversationEngineController {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly scope: AdminScopeService,
    private readonly resolver: AssistantProfileResolverService,
    private readonly diagnostics: AssistantProfileDiagnosticsService,
    private readonly engine: ConversationEngineService,
    private readonly compareService: ConversationEngineCompareService,
    private readonly testCases: ConversationEngineTestCasesService,
    private readonly knowledgePreview: KnowledgePreviewRetrievalService,
    private readonly responseDrafts: ResponseDraftService,
  ) {}

  @Get('settings')
  async settings(
    @Param('siteId') siteId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.getState(siteId);
  }

  @Put('settings')
  async updateSettings(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.updateSettings(siteId, body);
  }

  @Get('test-cases')
  async listTestCases(
    @Param('siteId') siteId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.getState(siteId);
  }

  @Post('test-cases')
  async createTestCase(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.createTestCase(siteId, body);
  }

  @Put('test-cases/:caseId')
  async updateTestCase(
    @Param('siteId') siteId: string,
    @Param('caseId') caseId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.updateTestCase(siteId, caseId, body);
  }

  @Delete('test-cases/:caseId')
  async deleteTestCase(
    @Param('siteId') siteId: string,
    @Param('caseId') caseId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.deleteTestCase(siteId, caseId);
  }

  @Post('test-cases/run')
  async runTestCases(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.assertAdminTestAccess(req, siteId);
    return this.testCases.runTestCases(siteId, body);
  }

  @Post('preview')
  async preview(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    const site = await this.sites.getSite(siteId);
    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const siteConfig = asRecord(site?.config);
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));

    if (!featureEnabled(siteConfig, moduleConfigs)) {
      return {
        conversationEnginePreview: null,
        assistantProfileDebug: (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug,
        previewEnabled: false,
      };
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const assistantProfile = this.resolver.resolve({ siteConfig, moduleConfigs });
    const knowledgeAvailable = await this.hasKnowledge(siteId);

    return {
      conversationEnginePreview: this.engine.preview({
        assistantProfile,
        latestUserMessage: message,
        conversationHistory: sanitizeHistory(body.history),
        existingConversationState: asRecord(body.existingConversationState),
        knowledgeAvailable,
        testMode: true,
      }),
      assistantProfileDebug: (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug,
      previewEnabled: true,
    };
  }

  @Post('compare')
  async compare(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    const site = await this.sites.getSite(siteId);
    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const siteConfig = asRecord(site?.config);
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));
    const assistantProfileDebug = (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug;

    if (!compareEnabled(siteConfig, moduleConfigs)) {
      return {
        compareEnabled: false,
        legacy: null,
        engine: null,
        comparison: {
          status: 'unknown',
          findings: ['Vergleichsmodus ist deaktiviert.'],
          risks: [],
          recommendations: ['conversationEngine.previewEnabled und conversationEngine.compareEnabled aktivieren.'],
        },
        assistantProfileDebug,
      };
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const assistantProfile = this.resolver.resolve({ siteConfig, moduleConfigs });
    const knowledgeAvailable = await this.hasKnowledge(siteId);

    return {
      compareEnabled: true,
      ...this.compareService.compare({
        assistantProfile,
        latestUserMessage: message,
        conversationHistory: sanitizeHistory(body.history),
        existingConversationState: asRecord(body.existingConversationState),
        knowledgeAvailable,
        testMode: true,
      }),
      assistantProfileDebug,
    };
  }

  @Post('response-preview')
  async responsePreview(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    const site = await this.sites.getSite(siteId);
    const modules = await this.siteModules.listForSite(siteId) as SiteModulePreview[];
    const siteConfig = asRecord(site?.config);
    const moduleConfigs = Object.fromEntries(modules.map((module) => [module.key, module.config || {}]));
    const assistantProfileDebug = (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug;

    if (!responsePreviewEnabled(siteConfig, moduleConfigs)) {
      return {
        responsePreviewEnabled: false,
        knowledgeRetrieval: {
          enabled: false,
          attempted: false,
          status: 'disabled',
          snippets: [],
          warnings: [],
          reasons: ['Antwortvorschau ist deaktiviert.'],
        },
        engineResponsePreview: null,
        conversationEnginePreview: null,
        assistantProfileDebug,
      };
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = sanitizeHistory(body.history);
    const assistantProfile = this.resolver.resolve({ siteConfig, moduleConfigs });
    const knowledgeAvailable = await this.hasKnowledge(siteId);
    const decision = this.engine.preview({
      assistantProfile,
      latestUserMessage: message,
      conversationHistory: history,
      existingConversationState: asRecord(body.existingConversationState),
      knowledgeAvailable,
      testMode: true,
    });
    const includeKnowledge = body.includeKnowledge === true;
    const allowKnowledgePreview = includeKnowledge && knowledgePreviewEnabled(siteConfig, moduleConfigs);
    const knowledgeRetrieval = await this.knowledgePreview.retrieve({
      tenantId: site?.tenant_id || '',
      siteId,
      assistantProfile,
      conversationDecision: decision,
      latestUserMessage: message,
      history,
      selectedAgentKey: decision.selectedAgentKey,
      knowledgeMode: assistantProfile.knowledgeMode,
      enabled: allowKnowledgePreview,
    });
    const engineResponsePreview = this.responseDrafts.preview({
      assistantProfile,
      decision,
      latestUserMessage: message,
      history,
      knowledgeAvailable,
      knowledgeRetrievalResult: knowledgeRetrieval,
      testMode: true,
    });
    const includeLegacyCompare = body.includeLegacyCompare === true;
    const comparison = includeLegacyCompare
      ? this.compareService.compare({
          assistantProfile,
          latestUserMessage: message,
          conversationHistory: history,
          existingConversationState: asRecord(body.existingConversationState),
          knowledgeAvailable,
          testMode: true,
        })
      : null;

    return {
      responsePreviewEnabled: true,
      knowledgePreviewEnabled: knowledgePreviewEnabled(siteConfig, moduleConfigs),
      assistantProfileDebug,
      conversationEnginePreview: decision,
      knowledgeRetrieval,
      engineResponsePreview,
      legacy: comparison?.legacy || null,
      comparison: comparison?.comparison || null,
    };
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

  private async assertAdminTestAccess(req: { dashboardAuth?: unknown }, siteId: string) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
  }
}
