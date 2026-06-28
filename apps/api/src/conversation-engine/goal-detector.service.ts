import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent, ConversationStage } from './conversation-engine.types';

@Injectable()
export class GoalDetectorService {
  detect(context: ConversationContext, intent: ConversationIntent): { goal: ConversationGoal; stage: ConversationStage; reasons: string[] } {
    const tasks = context.assistantProfile.enabledTasks;
    const reasons: string[] = [];

    if (intent === 'question') {
      reasons.push('Frage soll quellenbasiert beantwortet werden.');
      return { goal: 'answer_from_knowledge', stage: 'answer', reasons };
    }

    if (intent === 'support') {
      reasons.push(tasks.includes('triage_support')
        ? 'Support-Triage ist im Profil aktiviert.'
        : 'Supportsignal erkannt; Preview priorisiert Problemlösung vor Kontaktsammlung.');
      return { goal: 'solve_problem', stage: 'qualify', reasons };
    }

    if (intent === 'ticket') {
      return { goal: 'create_ticket', stage: 'confirm', reasons: ['Ticketabsicht erkannt.'] };
    }

    if (intent === 'product_advice') {
      return { goal: 'recommend_product', stage: 'qualify', reasons: ['Produktberatung erkannt.'] };
    }

    if (intent === 'appointment') {
      const hasAppointmentIntegration = context.assistantProfile.agents.some((agent) =>
        agent.enabled && agent.integrations.some((integration) => /calendar|termin|appointment/i.test(integration)),
      );
      return {
        goal: hasAppointmentIntegration ? 'trigger_integration' : 'prepare_contact',
        stage: 'collect_details',
        reasons: [hasAppointmentIntegration ? 'Termin-Integration ist verfügbar.' : 'Terminwunsch erkannt; Kontaktvorbereitung ist erforderlich.'],
      };
    }

    if (intent === 'handoff' || intent === 'sales') {
      return { goal: 'prepare_contact', stage: 'collect_details', reasons: ['Kontakt- oder Abschlussziel erkannt.'] };
    }

    if (intent === 'complaint') {
      return { goal: 'escalate_human', stage: 'handoff', reasons: ['Beschwerde sollte an Menschen übergeben werden.'] };
    }

    return { goal: 'clarify_intent', stage: 'understand', reasons: ['Absicht muss geklärt werden.'] };
  }
}
