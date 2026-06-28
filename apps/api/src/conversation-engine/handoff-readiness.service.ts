import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal } from './conversation-engine.types';

@Injectable()
export class HandoffReadinessService {
  evaluate(context: ConversationContext, goal: ConversationGoal) {
    const profile = context.assistantProfile;
    const hasMissingFields = context.missingFields.length > 0;
    const shouldHandoff = goal === 'escalate_human' ||
      (Boolean(profile.handoffRules.enabled) &&
        (goal === 'prepare_contact' || goal === 'collect_request' || goal === 'create_ticket') &&
        (!profile.handoffRules.requireAllFields || !hasMissingFields));

    return {
      shouldHandoff,
      shouldSummarize: shouldHandoff && profile.handoffRules.summarizeBeforeHandoff,
      reason: shouldHandoff
        ? 'Übergabe wäre in der Preview bereit.'
        : hasMissingFields
          ? 'Übergabe noch nicht bereit, Pflichtinformationen fehlen.'
          : 'Übergabe nicht erforderlich.',
    };
  }
}
