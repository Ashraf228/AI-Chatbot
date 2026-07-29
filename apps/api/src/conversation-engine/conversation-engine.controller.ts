import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import {
  AssistantProfile,
  AssistantProfileDiagnosticsService,
  AssistantProfileResolverService,
  AssistantRequiredField,
} from '../assistant-profiles';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { SitesService } from '../sites/sites.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { ConversationEngineCompareService } from './conversation-engine-compare.service';
import { ConversationEngineRuntimeService } from './conversation-engine-runtime.service';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationEngineTestCasesService } from './conversation-engine-test-cases.service';
import { ConversationHistoryEntry } from './conversation-engine.types';
import { KnowledgePreviewRetrievalService } from './knowledge-preview-retrieval.service';
import { ResponseDraftService } from './response-draft.service';

type SiteModulePreview = {
  key: string;
  config: Record<string, unknown>;
};

const MAX_DEMO_PDF_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_DEMO_PDF_EXTRACTED_CHARS = 20_000;

type DemoPdfParseResult = {
  text?: string;
};

type DemoPdfParseInstance = {
  getText: () => Promise<DemoPdfParseResult>;
  destroy: () => Promise<void>;
};

type DemoPdfParseClass = new (input: { data: Buffer }) => DemoPdfParseInstance;

const DEMO_PDF_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_DEMO_PDF_UPLOAD_BYTES,
  },
  fileFilter: (
    _req: unknown,
    file: { mimetype?: string; originalname?: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const fileName = typeof file.originalname === 'string' ? file.originalname : '';
    if (!/\.pdf$/i.test(fileName)) {
      return cb(new BadRequestException('unsupported file type'), false);
    }
    if (file.mimetype && file.mimetype !== 'application/pdf') {
      return cb(new BadRequestException('unsupported file type'), false);
    }
    cb(null, true);
  },
};

function sanitizePdfDisplayFileName(fileName: string) {
  return fileName
    .replace(/[\\/\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function normalizeExtractedPdfText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

function isPdfUpload(file: Express.Multer.File) {
  if (!/\.pdf$/i.test(file.originalname || '')) {
    return false;
  }
  return !file.mimetype || file.mimetype === 'application/pdf';
}

function loadDemoPdfParser() {
  return require('pdf-parse') as { PDFParse: DemoPdfParseClass };
}

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

function adminTestOnlyEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  const siteEngine = asRecord(siteConfig.conversationEngine);
  const assistantModule = asRecord(moduleConfigs['assistant-profile']);
  const moduleEngine = asRecord(assistantModule.conversationEngine);
  const testsModule = asRecord(moduleConfigs['conversation-engine-tests']);
  const testsEngine = asRecord(testsModule.conversationEngine);
  return siteEngine.adminTestOnly === true || moduleEngine.adminTestOnly === true || testsEngine.adminTestOnly === true;
}

function runtimePilotEnabled(siteConfig: Record<string, unknown>, moduleConfigs: Record<string, Record<string, unknown>>) {
  return responsePreviewEnabled(siteConfig, moduleConfigs) && adminTestOnlyEnabled(siteConfig, moduleConfigs);
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

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeTextList(value: unknown, limit = 12) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, limit);
}

function sanitizeTargetUsers(value: unknown) {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 8);
  }
  return sanitizeTextList(value, 8);
}

function sanitizeRequiredFields(value: unknown): AssistantRequiredField[] {
  const fields = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\r?\n|,/)
      : [];

  return fields
    .map((entry) => typeof entry === 'string' ? entry.trim() : '')
    .filter((entry) => entry.length > 0)
    .slice(0, 8)
    .map((entry) => ({
      key: entry,
      label: entry,
      required: true,
      source: 'default',
    }));
}

function sanitizeTone(value: unknown): AssistantProfile['tone'] | null {
  if (value === 'formal' || value === 'friendly' || value === 'professional' || value === 'consultative') {
    return value;
  }
  return null;
}

function applyDemoWorkspaceProfileOverride(profile: AssistantProfile, body: Record<string, unknown>): AssistantProfile {
  const demoWorkspace = asRecord(body.demoWorkspace);
  if (Object.keys(demoWorkspace).length === 0) {
    return profile;
  }

  const assistantName = asString(demoWorkspace.assistantName);
  const companyContext = asString(demoWorkspace.companyContext);
  const assistantRole = asString(demoWorkspace.assistantRole);
  const targetUsers = sanitizeTargetUsers(demoWorkspace.targetAudience);
  const tone = sanitizeTone(demoWorkspace.tone);
  const allowedTasks = sanitizeTextList(demoWorkspace.allowedTasks, 16);
  const blockedTasks = new Set(sanitizeTextList(demoWorkspace.blockedTasks, 16));
  const requiredFields = sanitizeRequiredFields(demoWorkspace.requiredFields);
  const hasAllowedTaskOverride = Array.isArray(demoWorkspace.allowedTasks);
  const hasBlockedTaskOverride = Array.isArray(demoWorkspace.blockedTasks);
  const hasHandoffOverride = typeof demoWorkspace.handoffAllowed === 'boolean';
  const hasTicketOverride = typeof demoWorkspace.ticketAllowed === 'boolean';
  const handoffAllowed = hasHandoffOverride
    ? Boolean(demoWorkspace.handoffAllowed)
    : profile.handoffRules.enabled;
  const ticketAllowed = hasTicketOverride
    ? Boolean(demoWorkspace.ticketAllowed)
    : true;
  const hasTaskConstraint = hasAllowedTaskOverride || hasBlockedTaskOverride;
  const hasAgentConstraint = hasHandoffOverride || hasTicketOverride;

  const nextEnabledTasks = (hasAllowedTaskOverride ? allowedTasks : profile.enabledTasks)
    .filter((task) => !blockedTasks.has(task));
  const nextEnabledAgents = profile.enabledAgents.filter((agentKey) => {
    if (!handoffAllowed && agentKey === 'handoff-agent') {
      return false;
    }
    if (!ticketAllowed && ['ticket-agent', 'property-ticket-agent', 'it-support-agent'].includes(agentKey)) {
      return false;
    }
    return true;
  });

  return {
    ...profile,
    assistantName: assistantName || profile.assistantName,
    businessDescription: companyContext || profile.businessDescription,
    role: assistantRole || profile.role,
    targetUsers: targetUsers.length > 0 ? targetUsers : profile.targetUsers,
    tone: tone || profile.tone,
    enabledTasks: hasTaskConstraint ? nextEnabledTasks : profile.enabledTasks,
    requiredFields: requiredFields.length > 0 ? requiredFields : profile.requiredFields,
    handoffRules: {
      ...profile.handoffRules,
      enabled: handoffAllowed,
      handoffWhenUncertain: handoffAllowed ? profile.handoffRules.handoffWhenUncertain : false,
    },
    deliveryChannels: {
      ...profile.deliveryChannels,
      system: {
        enabled: ticketAllowed,
      },
    },
    enabledAgents: hasAgentConstraint ? nextEnabledAgents : profile.enabledAgents,
  };
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
    private readonly runtimePilot: ConversationEngineRuntimeService,
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

  @Get('demo-workspace/config')
  async getDemoWorkspaceConfig(
    @Param('siteId') siteId: string,
    @Req() req: { dashboardAuth?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    response.setHeader('Cache-Control', 'no-store');
    return this.testCases.getDemoWorkspaceConfig(siteId);
  }

  @Put('demo-workspace/config')
  async updateDemoWorkspaceConfig(
    @Param('siteId') siteId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { dashboardAuth?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = this.scope.getAuth(req);
    await this.scope.assertSiteAccess(auth, siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    response.setHeader('Cache-Control', 'no-store');
    return this.testCases.updateDemoWorkspaceConfig(siteId, body, auth.role || 'operator');
  }

  @Delete('demo-workspace/config')
  async deleteDemoWorkspaceConfig(
    @Param('siteId') siteId: string,
    @Req() req: { dashboardAuth?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    response.setHeader('Cache-Control', 'no-store');
    return this.testCases.deleteDemoWorkspaceConfig(siteId);
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

  @Post('runtime-pilot')
  async runtimePilotPreview(
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

    if (!runtimePilotEnabled(siteConfig, moduleConfigs)) {
      return {
        runtimePilotEnabled: false,
        activationBoundary: {
          mode: 'admin_test_only',
          publicWidgetActivation: false,
          productionActivation: false,
          deployRequired: false,
        },
        sideEffects: {
          planned: false,
          ticketDelivery: false,
          emailDelivery: false,
          webhookDelivery: false,
          providerCalls: false,
          dbAccessForNewLogic: false,
          sql: false,
          queryRunner: false,
        },
        knowledgeRetrieval: {
          enabled: false,
          attempted: false,
          status: 'disabled',
          snippets: [],
          warnings: [],
          reasons: ['Runtime-Pilot ist nur im expliziten Admin-Testmodus mit Antwortvorschau aktiv.'],
        },
        runtimeState: {
          selectedAgentKey: null,
          nextActionKey: null,
          shouldHandoff: false,
          shouldAskQuestion: false,
          handoffOfferSimulated: false,
          ticketFieldRequestSimulated: false,
          sourcesUsed: 0,
          sourceRequired: false,
        },
        conversationEnginePreview: null,
        engineResponsePreview: null,
        assistantProfileDebug,
        warnings: [],
        reasons: ['conversationEngine.responsePreviewEnabled und adminTestOnly muessen aktiv sein.'],
      };
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const assistantProfile = applyDemoWorkspaceProfileOverride(
      this.resolver.resolve({ siteConfig, moduleConfigs }),
      body,
    );
    const result = this.runtimePilot.preview({
      assistantProfile,
      latestUserMessage: message,
      conversationHistory: sanitizeHistory(body.history),
      existingConversationState: asRecord(body.existingConversationState),
      syntheticKnowledgeSnippets: body.knowledgeSnippets,
      testMode: true,
    });

    return {
      runtimePilotEnabled: true,
      assistantProfileDebug,
      ...result,
    };
  }

  @Post('knowledge/pdf-extract')
  @UseInterceptors(FileInterceptor('file', DEMO_PDF_UPLOAD_OPTIONS))
  async pdfExtract(
    @Param('siteId') siteId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { dashboardAuth?: unknown },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

    response.setHeader('Cache-Control', 'no-store');

    if (!file) {
      throw new BadRequestException('file missing');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('file missing');
    }

    if (file.size > MAX_DEMO_PDF_UPLOAD_BYTES) {
      throw new BadRequestException('PDF too large');
    }

    if (!isPdfUpload(file)) {
      throw new BadRequestException('unsupported file type');
    }

    const safeFileName = sanitizePdfDisplayFileName(file.originalname) || 'demo-upload.pdf';
    let parser: DemoPdfParseInstance | null = null;

    try {
      const { PDFParse } = loadDemoPdfParser();
      parser = new PDFParse({ data: file.buffer });
      const parsed = await parser.getText();
      const normalized = normalizeExtractedPdfText(parsed.text || '');

      if (!normalized) {
        throw new BadRequestException('PDF has no extractable text');
      }

      const extractedText = normalized.slice(0, MAX_DEMO_PDF_EXTRACTED_CHARS);
      return {
        fileName: safeFileName,
        extractedText,
        extractedChars: extractedText.length,
        originalChars: normalized.length,
        truncated: normalized.length > extractedText.length,
        boundary: {
          pdfStorageUsed: false,
          fileStorageUsed: false,
          dbWriteUsed: false,
          embeddingGenerationUsed: false,
          ragIndexingUsed: false,
          providerCallsUsed: false,
          ocrUsed: false,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('PDF could not be parsed');
    } finally {
      if (parser) {
        await parser.destroy().catch(() => undefined);
      }
    }
  }

  private async hasKnowledge(siteId: string) {
    const res = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM knowledge_sources
       WHERE site_id = $1
         AND is_active IS DISTINCT FROM false
         AND runtime_readiness = 'ready'`,
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
