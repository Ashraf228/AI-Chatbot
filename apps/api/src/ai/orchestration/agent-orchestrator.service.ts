import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../db/prisma.service';
import { SiteModulesService } from '../../site-modules/site-modules.service';
import { AgentDecision } from './agent-decision.types';
import { AgentMemoryService } from './agent-memory.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRunLoggerService } from './agent-run-logger.service';
import { normalizeLocalServiceIntakeFlowConfig } from '../../site-modules/module-configs';

type SiteConfigRow = {
  config: Record<string, unknown> | null;
};

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly db: PrismaService,
    private readonly siteModules: SiteModulesService,
    private readonly memory: AgentMemoryService,
    private readonly policy: AgentPolicyService,
    private readonly runLogger: AgentRunLoggerService,
  ) {}

  async decide(input: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    message: string;
    history: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  }): Promise<AgentDecision> {
    const run = await this.runLogger.start(input);
    try {
      const [memory, moduleContext, siteConfig] = await Promise.all([
        this.memory.load({
          conversationId: input.conversationId,
          message: input.message,
          history: input.history,
        }),
        this.getModuleContext(input.siteId),
        this.getSiteConfig(input.siteId),
      ]);
      const decision = this.policy.decide({
        ...input,
        memory,
        moduleContext,
        siteConfig,
      });
      const loggedDecision: AgentDecision = {
        ...decision,
        metadata: {
          ...decision.metadata,
          agentRunId: run?.runId || null,
        },
      };

      await this.runLogger.complete(run, loggedDecision);
      return loggedDecision;
    } catch (error) {
      await this.runLogger.fail(run, error);
      throw error;
    }
  }

  private async getModuleContext(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const enabled = new Set(modules.filter((module) => module.isEnabled).map((module) => module.key));
    const leadSales = modules.find((module) => ['lead-sales', 'lead_sales'].includes(module.key));
    const leadConfig = asObject(leadSales?.config);

    return {
      leadSalesEnabled: enabled.has('lead-sales') || enabled.has('lead_sales'),
      ecommerceAdvisorEnabled:
        enabled.has('ecommerce-product-advisor') || enabled.has('ecommerce_product_advisor'),
      propertyTicketingEnabled:
        enabled.has('property-ticketing') || enabled.has('property_ticket_agent'),
      itSupportEnabled: enabled.has('it-support') || enabled.has('it_support'),
      supportEnabled: enabled.has('support-agent') || enabled.has('support_agent') || enabled.has('knowledge-faq'),
      primaryGoal: asString(leadConfig.primaryGoal) || undefined,
      intakeFlow: leadConfig.intakeFlow
        ? normalizeLocalServiceIntakeFlowConfig(leadConfig.intakeFlow)
        : undefined,
    };
  }

  private async getSiteConfig(siteId: string) {
    const res = await this.db.query<SiteConfigRow>(
      `SELECT config
       FROM sites
       WHERE id = $1
       LIMIT 1`,
      [siteId],
    );
    const config = asObject(res.rows[0]?.config);
    const conversationFlow = asObject(config.conversationFlow);

    return {
      setupGoal: asString(config.setupGoal) || undefined,
      ctaText: asString(config.ctaText) || asString(conversationFlow.ctaText) || undefined,
      scheduleUrl:
        findFirstUrl(config, ['scheduleUrl', 'bookingUrl', 'calendarUrl', 'appointmentUrl', 'calendlyUrl', 'terminUrl']) ||
        findFirstUrl(conversationFlow, ['scheduleUrl', 'bookingUrl', 'calendarUrl', 'appointmentUrl', 'calendlyUrl', 'terminUrl']) ||
        undefined,
      contactUrl:
        findFirstUrl(config, ['contactUrl', 'ctaUrl', 'contactFormUrl', 'kontaktUrl']) ||
        findFirstUrl(conversationFlow, ['contactUrl', 'ctaUrl', 'contactFormUrl']) ||
        undefined,
      leadCaptureEnabled:
        typeof config.leadCaptureEnabled === 'boolean' ? config.leadCaptureEnabled : undefined,
      intakeFlow:
        Object.keys(conversationFlow).length > 0
          ? normalizeLocalServiceIntakeFlowConfig(conversationFlow)
          : undefined,
    };
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function findFirstUrl(config: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asString(config[key]);
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
  }
  return '';
}
