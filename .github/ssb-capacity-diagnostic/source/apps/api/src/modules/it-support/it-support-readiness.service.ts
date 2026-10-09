import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { TicketWebhookConfigService } from '../../integrations/ticket-webhook-config.service';
import {
  DEFAULT_IT_SUPPORT_MODULE_CONFIG,
  normalizeItSupportModuleConfig,
} from '../../site-modules/module-configs';
import { getSiteModuleDefinition } from '../../site-modules/module-registry';
import {
  evaluateItSupportReadiness,
  type ItSupportReadinessStatus,
} from './it-support-readiness';
import { listItKnowledgeBaseTemplates } from './it-knowledge-base-templates';

type SiteModuleRow = {
  module_key: string;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
};

type KnowledgeCountsRow = {
  active_count: string | number;
  imported_template_count: string | number;
  imported_template_keys: string[] | null;
};

export type ItSupportReadinessAction = {
  key: string;
  label: string;
  description?: string;
  href?: string;
  severity?: 'primary' | 'secondary' | 'warning';
  disabled?: boolean;
};

export type ItSupportReadinessResponse = {
  status: ItSupportReadinessStatus;
  label: string;
  summary: string;
  checks: Record<string, boolean>;
  missing: string[];
  warnings: string[];
  actions: ItSupportReadinessAction[];
  details: {
    requiredTicketFields: string[];
    importedItKnowledgeTemplateCount: number;
    availableItKnowledgeTemplateCount: number;
    activeKnowledgeSourceCount: number;
    ticketWebhook: {
      enabled: boolean;
      forwardingConfigured: boolean;
      hasSigningSecret: boolean;
      lastTestStatus: string | null;
      lastTestAt: string | null;
    };
  };
};

function toInt(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseInt(String(value || '0'), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class ItSupportReadinessService {
  constructor(
    private readonly db: PrismaService,
    private readonly ticketWebhook: TicketWebhookConfigService,
  ) {}

  async getReadiness(siteId: string): Promise<ItSupportReadinessResponse> {
    const [modules, knowledge, ticketWebhook] = await Promise.all([
      this.getModules(siteId),
      this.getKnowledgeCounts(siteId),
      this.ticketWebhook.getConfig(siteId),
    ]);

    const moduleByKey = new Map(modules.map((module) => [module.module_key, module]));
    const itSupportModule = moduleByKey.get('it-support');
    const knowledgeFaqModule = moduleByKey.get('knowledge-faq');
    const itSupportDefinition = getSiteModuleDefinition('it-support');
    const knowledgeFaqDefinition = getSiteModuleDefinition('knowledge-faq');
    const itSupportConfig = normalizeItSupportModuleConfig(
      itSupportModule?.config || itSupportDefinition?.defaultConfig || DEFAULT_IT_SUPPORT_MODULE_CONFIG,
    );
    const importedTemplateKeys = Array.isArray(knowledge.imported_template_keys)
      ? knowledge.imported_template_keys.filter((key): key is string => typeof key === 'string' && Boolean(key.trim()))
      : [];
    const availableTemplateKeys = listItKnowledgeBaseTemplates().map((template) => template.key);

    const evaluated = evaluateItSupportReadiness({
      itSupportEnabled: itSupportModule
        ? itSupportModule.is_enabled
        : Boolean(itSupportDefinition?.defaultEnabled),
      knowledgeFaqEnabled: knowledgeFaqModule
        ? knowledgeFaqModule.is_enabled
        : Boolean(knowledgeFaqDefinition?.defaultEnabled),
      requiredTicketFields: itSupportConfig.requiredTicketFields,
      ticketConfirmationRequired: itSupportConfig.ticketConfirmationRequired,
      escalationKeywords: itSupportConfig.escalationKeywords,
      hasTicketWebhook: ticketWebhook.forwardingConfigured,
      hasActiveKnowledgeSources: toInt(knowledge.active_count) > 0,
      availableItKnowledgeTemplateKeys: availableTemplateKeys,
      importedItKnowledgeTemplateKeys: importedTemplateKeys,
    });

    return {
      status: evaluated.status,
      label: evaluated.label,
      summary: evaluated.summary,
      checks: evaluated.checks,
      missing: evaluated.missing,
      warnings: evaluated.warnings,
      actions: this.buildActions(siteId, evaluated.status, evaluated.checks),
      details: {
        requiredTicketFields: itSupportConfig.requiredTicketFields,
        importedItKnowledgeTemplateCount: toInt(knowledge.imported_template_count),
        availableItKnowledgeTemplateCount: availableTemplateKeys.length,
        activeKnowledgeSourceCount: toInt(knowledge.active_count),
        ticketWebhook: {
          enabled: ticketWebhook.enabled,
          forwardingConfigured: ticketWebhook.forwardingConfigured,
          hasSigningSecret: ticketWebhook.hasSigningSecret,
          lastTestStatus: ticketWebhook.lastTestStatus,
          lastTestAt: ticketWebhook.lastTestAt,
        },
      },
    };
  }

  private async getModules(siteId: string) {
    const res = await this.db.query<SiteModuleRow>(
      `SELECT module_key, is_enabled, config
       FROM site_modules
       WHERE site_id = $1
         AND module_key IN ('it-support', 'knowledge-faq')`,
      [siteId],
    );
    return res.rows;
  }

  private async getKnowledgeCounts(siteId: string) {
    const res = await this.db.query<KnowledgeCountsRow>(
      `SELECT
         COUNT(*) FILTER (
           WHERE COALESCE(is_active, true) = true
             AND runtime_readiness = 'ready'
         ) AS active_count,
         COUNT(DISTINCT config->>'templateKey') FILTER (
           WHERE source_type = 'it_support_template'
             AND COALESCE(config->>'templateKey', '') <> ''
         ) AS imported_template_count,
         COALESCE(
           ARRAY_REMOVE(ARRAY_AGG(DISTINCT config->>'templateKey') FILTER (
             WHERE source_type = 'it_support_template'
               AND COALESCE(config->>'templateKey', '') <> ''
           ), NULL),
           ARRAY[]::text[]
         ) AS imported_template_keys
       FROM knowledge_sources
       WHERE site_id = $1`,
      [siteId],
    );
    return res.rows[0] || {
      active_count: 0,
      imported_template_count: 0,
      imported_template_keys: [],
    };
  }

  private buildActions(
    siteId: string,
    status: ItSupportReadinessStatus,
    checks: Record<string, boolean>,
  ): ItSupportReadinessAction[] {
    const actions: ItSupportReadinessAction[] = [];
    if (!checks.itSupportEnabled) {
      actions.push({
        key: 'enable-it-support',
        label: 'IT-Support Modul aktivieren',
        href: `/sites/${siteId}/modules`,
        severity: 'primary',
      });
    }
    if (!checks.knowledgeFaqEnabled) {
      actions.push({
        key: 'enable-knowledge-faq',
        label: 'Knowledge-FAQ aktivieren',
        href: `/sites/${siteId}/modules`,
        severity: 'primary',
      });
    }
    if (!checks.knowledgeBasePrepared) {
      actions.push({
        key: 'open-knowledge-base',
        label: 'Knowledge Base öffnen',
        description: 'Wissensquellen oder IT-Templates vorbereiten.',
        href: `/sites/${siteId}/knowledge`,
        severity: status === 'not_ready' ? 'primary' : 'warning',
      });
    }
    if (!checks.itKnowledgeTemplatesImported) {
      actions.push({
        key: 'import-it-templates',
        label: 'IT-Templates importieren',
        description: 'Backend-Templates sind vorbereitet; eine Dashboard-Importmaske folgt separat.',
        href: `/sites/${siteId}/knowledge`,
        severity: 'secondary',
        disabled: true,
      });
    }
    if (!checks.ticketForwardingConfigured) {
      actions.push({
        key: 'configure-ticket-webhook',
        label: 'Ticket-Weiterleitung konfigurieren',
        href: `/sites/${siteId}/integrations`,
        severity: 'warning',
      });
    } else {
      actions.push({
        key: 'test-ticket-webhook',
        label: 'Ticket-Webhook testen',
        href: `/sites/${siteId}/integrations`,
        severity: 'secondary',
      });
    }
    actions.push({
      key: 'open-test-chat',
      label: 'Testchat öffnen',
      href: `/sites/${siteId}#customer-test-chat`,
      severity: status === 'ready' ? 'primary' : 'secondary',
    });
    return actions;
  }
}
