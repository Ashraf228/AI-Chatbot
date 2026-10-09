import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';

import { AuditLogService } from '../../audit-logs/audit-log.service';
import { CustomerKnowledgePoweruserAuthService } from './customer-knowledge-poweruser-auth.service';
import {
  ItKnowledgeTemplateImportMode,
  ItKnowledgeTemplateImportService,
} from './it-knowledge-template-import.service';

const IMPORT_BODY_KEYS = new Set(['templateKeys', 'mode']);
const IMPORT_MODES = new Set<ItKnowledgeTemplateImportMode>(['skip_existing', 'overwrite']);

type RequestHeaders = Record<string, string | string[] | undefined>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseImportBody(value: unknown): {
  templateKeys: string[];
  mode: ItKnowledgeTemplateImportMode;
} {
  if (!isRecord(value) || Object.keys(value).some((key) => !IMPORT_BODY_KEYS.has(key))) {
    throw new BadRequestException('Invalid request');
  }
  if (!Array.isArray(value.templateKeys) || value.templateKeys.length === 0 || value.templateKeys.length > 20) {
    throw new BadRequestException('Invalid request');
  }

  const templateKeys = value.templateKeys.map((key) => typeof key === 'string' ? key.trim() : '');
  if (
    templateKeys.some((key) => !key || key.length > 120 || !/^[a-z0-9-]+$/.test(key))
    || new Set(templateKeys).size !== templateKeys.length
  ) {
    throw new BadRequestException('Invalid request');
  }

  const mode = value.mode === undefined ? 'skip_existing' : value.mode;
  if (!IMPORT_MODES.has(mode as ItKnowledgeTemplateImportMode)) {
    throw new BadRequestException('Invalid request');
  }
  return { templateKeys, mode: mode as ItKnowledgeTemplateImportMode };
}

@Controller('customer/it-knowledge')
export class CustomerKnowledgeController {
  constructor(
    private readonly auth: CustomerKnowledgePoweruserAuthService,
    private readonly templates: ItKnowledgeTemplateImportService,
    private readonly auditLogs: AuditLogService,
  ) {}

  @Get(':siteId/templates')
  async listTemplates(
    @Param('siteId') siteId: string,
    @Headers() headers: RequestHeaders,
  ) {
    const context = await this.authorize(headers, siteId);
    return this.templates.listItKnowledgeTemplatesForSite(context);
  }

  @Post(':siteId/templates/import')
  async importTemplates(
    @Param('siteId') siteId: string,
    @Body() body: unknown,
    @Headers() headers: RequestHeaders,
  ) {
    const input = parseImportBody(body);
    const context = await this.authorize(headers, siteId);
    const result = await this.templates.importItKnowledgeTemplatesForSite({
      tenantId: context.tenantId,
      siteId: context.siteId,
      templateKeys: input.templateKeys,
      mode: input.mode,
      createdBy: context.actorId,
    });
    await this.auditLogs.record({
      siteId: context.siteId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      action: 'import_it_knowledge_templates',
      resourceType: 'knowledge_source',
      metadata: {
        templateKeys: input.templateKeys,
        mode: input.mode,
        importedCount: result.imported.length,
        skippedCount: result.skipped.length,
        overwrittenCount: result.overwritten.length,
        providerCallsUsed: false,
        answerReadyTransitionAdded: false,
      },
    });
    return result;
  }

  @Delete(':siteId/templates/:sourceId')
  async deleteTemplate(
    @Param('siteId') siteId: string,
    @Param('sourceId') sourceId: string,
    @Headers() headers: RequestHeaders,
  ) {
    const context = await this.authorize(headers, siteId);
    const result = await this.templates.deleteItKnowledgeTemplateDraft({
      tenantId: context.tenantId,
      siteId: context.siteId,
      sourceId,
    });
    await this.auditLogs.record({
      siteId: context.siteId,
      actorId: context.actorId,
      actorRole: context.actorRole,
      action: 'delete_it_knowledge_template',
      resourceType: 'knowledge_source',
      resourceId: sourceId,
      metadata: { providerCallsUsed: false },
    });
    return result;
  }

  private authorize(headers: RequestHeaders, siteId: string) {
    return this.auth.authorize({
      authorizationHeader: headers.authorization,
      dashboardTokenHeader: headers['x-dashboard-token'],
      targetSiteId: siteId,
    });
  }
}
