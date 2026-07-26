import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent } from './conversation-engine.types';
import { getRoutingSignals } from './routing-signals';

@Injectable()
export class HandoffReadinessService {
  evaluate(context: ConversationContext, intent: ConversationIntent, goal: ConversationGoal, nextActionKey?: string) {
    const profile = context.assistantProfile;
    const hasMissingFields = context.missingFields.length > 0;
    const signals = getRoutingSignals(context.normalizedText);
    if (signals.humanIdentityQuestion) {
      return {
        shouldHandoff: false,
        shouldSummarize: false,
        reason: 'Identitaetsfragen brauchen keine menschliche Uebergabe.',
      };
    }
    const shouldHandoff = nextActionKey === 'collect_ticket_fields' ||
      nextActionKey === 'offer_handoff' ||
      (nextActionKey === 'block_request' && !signals.legalFinalityRequest) ||
      (Boolean(profile.handoffRules.enabled) &&
        (goal === 'prepare_contact' || goal === 'collect_request' || goal === 'create_ticket') &&
        (!profile.handoffRules.requireAllFields || !hasMissingFields)) ||
      (goal === 'solve_problem' && intent === 'support' && signals.forwardingPreference);
    const gatedHandoff = intent === 'sales' && goal === 'escalate_human' && nextActionKey === 'collect_ticket_fields'
      ? false
      : shouldHandoff;

    return {
      shouldHandoff: gatedHandoff,
      shouldSummarize: gatedHandoff && profile.handoffRules.summarizeBeforeHandoff,
      reason: gatedHandoff
        ? 'Übergabe wäre in der Preview bereit.'
        : hasMissingFields
          ? 'Übergabe noch nicht bereit, Pflichtinformationen fehlen.'
          : 'Übergabe nicht erforderlich.',
    };
  }
}
