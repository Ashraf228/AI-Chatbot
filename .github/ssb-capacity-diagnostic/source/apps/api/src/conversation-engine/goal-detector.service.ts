import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent, ConversationStage } from './conversation-engine.types';
import { getRoutingSignals } from './routing-signals';

@Injectable()
export class GoalDetectorService {
  detect(context: ConversationContext, intent: ConversationIntent): { goal: ConversationGoal; stage: ConversationStage; reasons: string[] } {
    const tasks = context.assistantProfile.enabledTasks;
    const reasons: string[] = [];
    const signals = getRoutingSignals(context.normalizedText);
    const hasMissingFields = context.missingFields.length > 0;

    if (signals.humanIdentityQuestion) {
      reasons.push('Identitaetsfrage wird mit sicherem Nicht-Mensch-Fallback beantwortet.');
      return { goal: 'escalate_human', stage: 'recovery', reasons };
    }

    if (signals.forbiddenOperationalRequest || signals.forbiddenPrivacyExecutionRequest || signals.legalFinalityRequest) {
      reasons.push('Verbotene Ausfuehrungs-, Daten- oder Finalitaetsanfrage erkannt.');
      return { goal: 'escalate_human', stage: 'handoff', reasons };
    }

    if (intent === 'question') {
      reasons.push('Frage soll quellenbasiert beantwortet werden.');
      return { goal: 'answer_from_knowledge', stage: 'answer', reasons };
    }

    if (intent === 'support') {
      if (signals.forwardingPreference) {
        reasons.push('Supportfall mit Weiterleitungswunsch erkannt.');
        return { goal: 'solve_problem', stage: 'handoff', reasons };
      }
      if (signals.ticketRequest || (signals.explicitHumanRequest && !signals.callbackRequest)) {
        reasons.push('Supportfall mit explizitem Mensch-/Ticketwunsch erkannt.');
        return { goal: 'escalate_human', stage: hasMissingFields ? 'collect_details' : 'handoff', reasons };
      }
      reasons.push(tasks.includes('triage_support')
        ? 'Support-Triage ist im Profil aktiviert.'
        : 'Supportsignal erkannt; Preview priorisiert Problemlösung vor Kontaktsammlung.');
      return { goal: 'solve_problem', stage: hasMissingFields ? 'qualify' : 'answer', reasons };
    }

    if (intent === 'ticket') {
      return { goal: 'create_ticket', stage: 'confirm', reasons: ['Ticketabsicht erkannt.'] };
    }

    if (intent === 'product_advice') {
      return { goal: 'recommend_product', stage: hasMissingFields ? 'qualify' : 'answer', reasons: ['Produktberatung erkannt.'] };
    }

    if (intent === 'appointment') {
      if (signals.ambiguousAppointmentPing) {
        return {
          goal: 'escalate_human',
          stage: 'qualify',
          reasons: ['Sehr knapper Terminwunsch erkannt; zuerst den Anlass klaeren.'],
        };
      }
      return {
        goal: 'escalate_human',
        stage: hasMissingFields ? 'collect_details' : 'handoff',
        reasons: ['Termin- oder Gespraechswunsch braucht menschliche Uebergabe.'],
      };
    }

    if (intent === 'handoff') {
      return { goal: 'prepare_contact', stage: 'collect_details', reasons: ['Kontakt- oder Abschlussziel erkannt.'] };
    }

    if (intent === 'sales') {
      if (signals.explicitHumanRequest || /\b(ansprechperson|mehrere teams|mehrere team)\b/i.test(context.normalizedText)) {
        reasons.push('Kommerzielle Anfrage mit klarer Ansprechpartner-/Uebergabeerwartung erkannt.');
        return { goal: 'escalate_human', stage: hasMissingFields ? 'qualify' : 'handoff', reasons };
      }
      if (hasAdvancedCommercialSignal(context.normalizedText)) {
        reasons.push('Kommerzielle Rueckfrage soll sicher uebergeben oder qualifiziert werden.');
        return { goal: 'escalate_human', stage: hasMissingFields ? 'qualify' : 'handoff', reasons };
      }
      return { goal: 'prepare_contact', stage: 'collect_details', reasons: ['Sales-Signal erkannt.'] };
    }

    if (intent === 'complaint') {
      return {
        goal: 'escalate_human',
        stage: hasMissingFields ? 'collect_details' : 'handoff',
        reasons: ['Beschwerde sollte an Menschen uebergeben werden.'],
      };
    }

    if (intent === 'unknown' && signals.ambiguousAppointmentPing) {
      return { goal: 'escalate_human', stage: 'qualify', reasons: ['Kurzform fuer Termin erkannt; erst Absicht sicher klaeren.'] };
    }

    return { goal: 'clarify_intent', stage: 'understand', reasons: ['Absicht muss geklärt werden.'] };
  }
}

function hasQuestionSignal(text: string) {
  return text.includes('?') || /\b(was|wie|warum|wann|wo|welche|kann)\b/i.test(text);
}

function hasAdvancedCommercialSignal(text: string) {
  return /\b(budget|roi|rechnet sich|wenn wir uns entscheiden|starten|procurement|beschaffung)\b/i.test(text);
}
