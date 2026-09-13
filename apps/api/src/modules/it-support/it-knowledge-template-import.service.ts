import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { UsageLimitService } from '../../billing/usage-limit.service';
import type { Queryable } from '../../db/database.service';
import { PrismaService } from '../../db/prisma.service';
import { KnowledgeSourcesService } from '../../knowledge-sources/knowledge-sources.service';
import {
  ItKnowledgeTemplate,
  getItKnowledgeBaseTemplate,
  listItKnowledgeBaseTemplates,
  renderItKnowledgeTemplateAsKnowledgeDocument,
} from './it-knowledge-base-templates';

export type ItKnowledgeTemplateImportMode = 'skip_existing' | 'overwrite';

export type ImportItKnowledgeTemplatesForSiteInput = {
  tenantId: string;
  siteId: string;
  templateKeys?: string[];
  createdBy?: string;
  mode?: ItKnowledgeTemplateImportMode;
};

export type ItKnowledgeTemplateImportItemResult = {
  templateKey: string;
  sourceId: string;
  status: 'imported' | 'skipped' | 'overwritten';
};

export type ItKnowledgeTemplateImportResult = {
  tenantId: string;
  siteId: string;
  mode: ItKnowledgeTemplateImportMode;
  imported: ItKnowledgeTemplateImportItemResult[];
  skipped: ItKnowledgeTemplateImportItemResult[];
  overwritten: ItKnowledgeTemplateImportItemResult[];
  providerCallsUsed: false;
  answerReadyTransitionAdded: false;
};

type ExistingTemplateSourceRow = {
  id: string;
  is_active: boolean;
  runtime_readiness: string;
  template_key?: string;
};

type SiteTenantRow = {
  id: string;
  tenant_id: string | null;
};

const TEMPLATE_VERSION = '2026-06-10';

function templateConfig(template: ItKnowledgeTemplate, createdBy?: string) {
  return {
    documentType: 'manual',
    templateKey: template.key,
    templateVersion: TEMPLATE_VERSION,
    industry: 'it-support',
    category: template.category,
    issueType: template.issueType,
    affectedSystem: template.affectedSystem || null,
    tags: template.tags,
    createdBy: createdBy || null,
    content: renderItKnowledgeTemplateAsKnowledgeDocument(template),
    providerCallsUsed: false,
    answerReady: false,
  };
}

@Injectable()
export class ItKnowledgeTemplateImportService {
  constructor(
    private readonly db: PrismaService,
    private readonly knowledgeSources: KnowledgeSourcesService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  async listItKnowledgeTemplatesForSite(input: { tenantId: string; siteId: string }) {
    const tenantId = input.tenantId?.trim();
    const siteId = input.siteId?.trim();
    if (!tenantId || !siteId) {
      throw new BadRequestException('tenantId and siteId required');
    }

    await this.assertSiteBelongsToTenant(siteId, tenantId);
    const existing = await this.db.query<ExistingTemplateSourceRow>(
      `SELECT id, config->>'templateKey' AS template_key
       FROM knowledge_sources
       WHERE tenant_id = $1
         AND site_id = $2
         AND source_type = 'it_support_template'
         AND is_active = false
         AND runtime_readiness = 'not_ready'
       ORDER BY created_at DESC`,
      [tenantId, siteId],
    );
    const sourceByTemplateKey = new Map<string, string>();
    for (const row of existing.rows) {
      if (row.template_key && !sourceByTemplateKey.has(row.template_key)) {
        sourceByTemplateKey.set(row.template_key, row.id);
      }
    }

    return {
      tenantId,
      siteId,
      templates: listItKnowledgeBaseTemplates().map((template) => ({
        key: template.key,
        title: template.title,
        category: template.category,
        issueType: template.issueType,
        tags: [...template.tags],
        importedSourceId: sourceByTemplateKey.get(template.key) || null,
      })),
      providerCallsUsed: false as const,
      answerReadyTransitionAdded: false as const,
    };
  }

  async importItKnowledgeTemplatesForSite(
    input: ImportItKnowledgeTemplatesForSiteInput,
  ): Promise<ItKnowledgeTemplateImportResult> {
    const tenantId = input.tenantId?.trim();
    const siteId = input.siteId?.trim();
    if (!tenantId) {
      throw new BadRequestException('tenantId missing');
    }
    if (!siteId) {
      throw new BadRequestException('siteId missing');
    }

    const mode: ItKnowledgeTemplateImportMode = input.mode || 'skip_existing';
    if (mode !== 'skip_existing' && mode !== 'overwrite') {
      throw new BadRequestException('Invalid import mode');
    }
    const templates = this.resolveTemplates(input.templateKeys);
    return this.db.transaction(async (tx) => {
      await this.assertSiteBelongsToTenant(siteId, tenantId, tx);

      const planned = [] as Array<{ template: ItKnowledgeTemplate; existing: ExistingTemplateSourceRow | null }>;
      for (const template of templates) {
        const existing = await this.findExistingTemplateSource({ tenantId, siteId, templateKey: template.key }, tx);
        if (existing && existing.is_active === false && existing.runtime_readiness === 'not_ready') {
          planned.push({ template, existing });
          continue;
        }
        if (existing) {
          throw new ConflictException('IT knowledge template is not an editable draft');
        }
        planned.push({ template, existing });
      }
      const newSourceCount = planned.filter((item) => !item.existing).length;
      if (newSourceCount > 0) {
        await this.usageLimits.assertWithinLimit(tenantId, 'maxKnowledgeSources', newSourceCount, tx);
      }

      const result: ItKnowledgeTemplateImportResult = {
        tenantId,
        siteId,
        mode,
        imported: [],
        skipped: [],
        overwritten: [],
        providerCallsUsed: false,
        answerReadyTransitionAdded: false,
      };

      for (const { template, existing } of planned) {
        if (existing && mode === 'skip_existing') {
          result.skipped.push({
            templateKey: template.key,
            sourceId: existing.id,
            status: 'skipped',
          });
          continue;
        }

        const sourceId = existing
          ? await this.overwriteTemplateSource({
              tenantId,
              siteId,
              sourceId: existing.id,
              template,
              createdBy: input.createdBy,
            }, tx)
          : await this.createTemplateSource({
              tenantId,
              siteId,
              template,
              createdBy: input.createdBy,
            }, tx);

        const item: ItKnowledgeTemplateImportItemResult = {
          templateKey: template.key,
          sourceId,
          status: existing ? 'overwritten' : 'imported',
        };

        if (existing) {
          result.overwritten.push(item);
        } else {
          result.imported.push(item);
        }
      }

      return result;
    });
  }

  async deleteItKnowledgeTemplateDraft(input: { tenantId: string; siteId: string; sourceId: string }) {
    const tenantId = input.tenantId?.trim();
    const siteId = input.siteId?.trim();
    const sourceId = input.sourceId?.trim();
    if (!tenantId || !siteId || !sourceId) {
      throw new BadRequestException('tenantId, siteId and sourceId required');
    }

    return this.db.transaction(async (tx) => {
      await this.assertSiteBelongsToTenant(siteId, tenantId, tx);
      const deleted = await tx.query<{ id: string }>(
        `DELETE FROM knowledge_sources
         WHERE id = $1
           AND tenant_id = $2
           AND site_id = $3
           AND source_type = 'it_support_template'
           AND is_active = false
           AND runtime_readiness = 'not_ready'
         RETURNING id`,
        [sourceId, tenantId, siteId],
      );
      if (deleted.rows.length !== 1) {
        throw new NotFoundException('Knowledge source not found');
      }
      return {
        ok: true as const,
        sourceId,
        siteId,
        providerCallsUsed: false as const,
      };
    });
  }

  private resolveTemplates(templateKeys?: string[]) {
    if (!Array.isArray(templateKeys) || templateKeys.length === 0) {
      return listItKnowledgeBaseTemplates();
    }

    const templates: ItKnowledgeTemplate[] = [];
    const seen = new Set<string>();
    for (const rawKey of templateKeys) {
      const key = typeof rawKey === 'string' ? rawKey.trim().toLowerCase() : '';
      if (!key || seen.has(key)) {
        continue;
      }
      const template = getItKnowledgeBaseTemplate(key);
      if (!template) {
        throw new BadRequestException(`Unknown IT knowledge template: ${key}`);
      }
      seen.add(key);
      templates.push(template);
    }

    if (templates.length === 0) {
      throw new BadRequestException('No valid IT knowledge templates selected');
    }

    return templates;
  }

  private async assertSiteBelongsToTenant(siteId: string, tenantId: string, db: Queryable = this.db) {
    const site = await db.query<SiteTenantRow>(
      `SELECT id, tenant_id
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [siteId],
    );

    const row = site.rows[0];
    if (!row) {
      throw new BadRequestException('Invalid siteId');
    }
    if (row.tenant_id && row.tenant_id !== tenantId) {
      throw new BadRequestException('Site does not belong to tenant');
    }
  }

  private async findExistingTemplateSource(input: {
    tenantId: string;
    siteId: string;
    templateKey: string;
  }, db: Queryable = this.db) {
    const existing = await db.query<ExistingTemplateSourceRow>(
      `SELECT id, is_active, runtime_readiness
       FROM knowledge_sources
       WHERE site_id = $1
         AND tenant_id = $2
         AND source_type = 'it_support_template'
         AND config->>'templateKey' = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.siteId, input.tenantId, input.templateKey],
    );

    return existing.rows[0] || null;
  }

  private async createTemplateSource(input: {
    tenantId: string;
    siteId: string;
    template: ItKnowledgeTemplate;
    createdBy?: string;
  }, db: Queryable = this.db) {
    return this.knowledgeSources.createForSite({
      tenantId: input.tenantId,
      siteId: input.siteId,
      sourceType: 'it_support_template',
      label: input.template.title,
      description: 'IT-Support Knowledge-Base Template',
      syncStatus: 'pending',
      isActive: false,
      ingestStatus: 'created',
      indexStatus: 'not_requested',
      runtimeReadiness: 'not_ready',
      config: templateConfig(input.template, input.createdBy),
    }, db);
  }

  private async overwriteTemplateSource(input: {
    tenantId: string;
    siteId: string;
    sourceId: string;
    template: ItKnowledgeTemplate;
    createdBy?: string;
  }, db: Queryable) {
    return this.knowledgeSources.replaceWithInactiveDraft({
      sourceId: input.sourceId,
      tenantId: input.tenantId,
      siteId: input.siteId,
      label: input.template.title,
      description: 'IT-Support Knowledge-Base Template',
      config: templateConfig(input.template, input.createdBy),
    }, db);
  }
}
