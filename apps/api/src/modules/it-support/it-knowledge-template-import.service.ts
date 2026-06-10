import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../db/prisma.service';
import { IngestService } from '../../ingest/ingest.service';
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
};

type ExistingTemplateSourceRow = {
  id: string;
};

type SiteTenantRow = {
  id: string;
  tenant_id: string | null;
};

const TEMPLATE_VERSION = '2026-06-10';

@Injectable()
export class ItKnowledgeTemplateImportService {
  constructor(
    private readonly db: PrismaService,
    private readonly knowledgeSources: KnowledgeSourcesService,
    private readonly ingest: IngestService,
  ) {}

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

    await this.assertSiteBelongsToTenant(siteId, tenantId);

    const mode: ItKnowledgeTemplateImportMode = input.mode || 'skip_existing';
    const templates = this.resolveTemplates(input.templateKeys);
    const result: ItKnowledgeTemplateImportResult = {
      tenantId,
      siteId,
      mode,
      imported: [],
      skipped: [],
      overwritten: [],
    };

    for (const template of templates) {
      const existing = await this.findExistingTemplateSource({ tenantId, siteId, templateKey: template.key });

      if (existing && mode === 'skip_existing') {
        result.skipped.push({
          templateKey: template.key,
          sourceId: existing.id,
          status: 'skipped',
        });
        continue;
      }

      const sourceId = existing?.id || (await this.createTemplateSource({
        tenantId,
        siteId,
        template,
        createdBy: input.createdBy,
      }));

      await this.ingest.ingestTextIntoExistingSource({
        tenantId,
        siteId,
        sourceId,
        type: 'manual',
        title: template.title,
        text: renderItKnowledgeTemplateAsKnowledgeDocument(template),
        metadata: {
          kind: 'it_support_template',
          templateKey: template.key,
          templateVersion: TEMPLATE_VERSION,
          industry: 'it-support',
          category: template.category,
          issueType: template.issueType,
          tags: template.tags,
        },
      });

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

  private async assertSiteBelongsToTenant(siteId: string, tenantId: string) {
    const site = await this.db.query<SiteTenantRow>(
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
  }) {
    const existing = await this.db.query<ExistingTemplateSourceRow>(
      `SELECT id
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
  }) {
    return this.knowledgeSources.createForSite({
      tenantId: input.tenantId,
      siteId: input.siteId,
      sourceType: 'it_support_template',
      label: input.template.title,
      description: 'IT-Support Knowledge-Base Template',
      syncStatus: 'processing',
      config: {
        documentType: 'manual',
        templateKey: input.template.key,
        templateVersion: TEMPLATE_VERSION,
        industry: 'it-support',
        category: input.template.category,
        issueType: input.template.issueType,
        affectedSystem: input.template.affectedSystem || null,
        tags: input.template.tags,
        createdBy: input.createdBy || null,
        content: renderItKnowledgeTemplateAsKnowledgeDocument(input.template),
      },
    });
  }
}
