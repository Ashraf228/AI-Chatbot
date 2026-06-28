import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent } from './conversation-engine.types';

type AgentSelection = {
  selectedAgentKey: string | null;
  suggestedAgentKey: string | null;
  agentAvailable: boolean;
  reason: string;
};

const AGENT_ALIASES: Record<string, string[]> = {
  'sales-agent': ['lead-sales-agent'],
  'product-advisor-agent': ['ecommerce-product-advisor'],
  'ticket-agent': ['property-ticket-agent', 'it-support-agent'],
};

@Injectable()
export class AgentSelectorService {
  select(context: ConversationContext, intent: ConversationIntent, goal: ConversationGoal): AgentSelection {
    const enabledAgents = context.assistantProfile.enabledAgents;
    const choose = (suggestedAgentKey: string, fallbackAgentKeys: string[], reason: string): AgentSelection => {
      const candidates = [suggestedAgentKey, ...(AGENT_ALIASES[suggestedAgentKey] || []), ...fallbackAgentKeys];
      const selected = candidates.find((agentKey) => enabledAgents.includes(agentKey)) || null;
      return {
        selectedAgentKey: selected,
        suggestedAgentKey,
        agentAvailable: selected === suggestedAgentKey,
        reason: selected
          ? selected === suggestedAgentKey
            ? reason
            : `${reason} Fachlich vorgeschlagen: ${suggestedAgentKey}; gewählt wurde Fallback ${selected}.`
          : `${reason} Fachlich vorgeschlagen: ${suggestedAgentKey}; kein passender Agent ist aktiviert.`,
      };
    };

    if (intent === 'complaint' || goal === 'escalate_human') {
      return choose('handoff-agent', ['support-agent', 'sales-agent', 'lead-sales-agent', 'knowledge-agent'], 'Übergabe-Agent passt zur Beschwerde oder Eskalation.');
    }

    if (intent === 'appointment' || goal === 'trigger_integration') {
      return choose('appointment-agent', ['handoff-agent', 'sales-agent', 'lead-sales-agent', 'knowledge-agent'], 'Termin-Agent passt zur Terminabsicht.');
    }

    if (intent === 'support' || goal === 'solve_problem') {
      return choose('support-agent', ['knowledge-agent'], 'Support-Agent passt zur erkannten Supportabsicht.');
    }

    if (intent === 'ticket' || goal === 'create_ticket') {
      return choose('ticket-agent', ['support-agent', 'knowledge-agent'], 'Ticket-Agent passt zur Ticketabsicht.');
    }

    if (intent === 'product_advice' || goal === 'recommend_product') {
      return choose('product-advisor-agent', ['sales-agent', 'lead-sales-agent', 'knowledge-agent'], 'Produktberater-Agent passt zur Produktberatung.');
    }

    if (intent === 'sales' || goal === 'prepare_contact' || goal === 'collect_request') {
      return choose('sales-agent', ['lead-sales-agent', 'handoff-agent', 'knowledge-agent'], 'Sales-/Kontakt-Agent passt zur Kontaktsammlung.');
    }

    if (enabledAgents.includes('knowledge-agent')) {
      return {
        selectedAgentKey: 'knowledge-agent',
        suggestedAgentKey: 'knowledge-agent',
        agentAvailable: true,
        reason: 'Wissens-Agent als sicherer Standard gewählt.',
      };
    }

    return {
      selectedAgentKey: enabledAgents[0] || null,
      suggestedAgentKey: enabledAgents[0] || null,
      agentAvailable: Boolean(enabledAgents[0]),
      reason: enabledAgents[0] ? 'Erster aktivierter Agent gewählt.' : 'Kein Agent aktiviert.',
    };
  }
}
