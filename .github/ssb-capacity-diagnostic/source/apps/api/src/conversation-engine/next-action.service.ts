import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent } from './conversation-engine.types';
import { getRoutingSignals } from './routing-signals';

function labelForField(key: string) {
  const labels: Record<string, string> = {
    problem: 'Problem oder Anliegen klären',
    urgency: 'Dringlichkeit erfragen',
    fullAddress: 'vollständige Einsatzadresse erfragen',
    fullName: 'Vor- und Nachname erfragen',
    phone: 'Telefonnummer erfragen',
    email: 'E-Mail-Adresse erfragen',
    reporterEmail: 'Kontaktadresse erfragen',
    impact: 'Auswirkung erfragen',
    affectedSystem: 'betroffenes System erfragen',
    description: 'Beschreibung erfragen',
  };
  return labels[key] || `${key} erfragen`;
}

@Injectable()
export class NextActionService {
  decide(context: ConversationContext, intent: ConversationIntent, goal: ConversationGoal) {
    const signals = getRoutingSignals(context.normalizedText);
    const collectFields = context.missingFields.length > 0 &&
      (goal === 'prepare_contact' || goal === 'collect_request' || goal === 'create_ticket' || goal === 'escalate_human');

    if (signals.humanIdentityQuestion) {
      return {
        nextActionKey: 'fallback_to_safe_response',
        nextAction: 'Sicheren Nicht-Mensch-Fallback klarstellen',
        shouldAskQuestion: false,
        reason: 'Identitaetsfragen brauchen nur eine klare, nicht-ausfuehrende Einordnung.',
      };
    }

    if (intent === 'appointment' &&
      goal === 'escalate_human' &&
      context.missingFields.length === 1 &&
      context.missingFields[0] === 'description') {
      return {
        nextActionKey: 'ask_clarifying_question',
        nextAction: 'Absicht mit einer kurzen Rückfrage klären: Geht es um Support, Beratung oder Kontaktaufnahme?',
        shouldAskQuestion: true,
        reason: 'Knapper Terminwunsch braucht zuerst einen kurzen Anlass.',
      };
    }

    if (signals.forbiddenOperationalRequest || signals.forbiddenPrivacyExecutionRequest || signals.legalFinalityRequest) {
      return {
        nextActionKey: 'block_request',
        nextAction: 'Anfrage sicher blockieren und erlaubten naechsten Schritt erklaeren',
        shouldAskQuestion: false,
        reason: 'Verbotene Anfrage wird nicht ausgefuehrt.',
      };
    }

    if (collectFields) {
      return {
        nextActionKey: 'collect_ticket_fields',
        nextAction: labelForField(context.missingFields[0]),
        shouldAskQuestion: true,
        reason: `Nächstes fehlendes Pflichtfeld: ${context.missingFields[0]}.`,
      };
    }

    if ((intent === 'support' && signals.forwardingPreference) || goal === 'escalate_human') {
      return {
        nextActionKey: 'offer_handoff',
        nextAction: 'Menschliche Uebergabe vorbereiten',
        shouldAskQuestion: false,
        reason: 'Uebergabe oder Eskalation ist der sichere naechste Schritt.',
      };
    }

    if (goal === 'answer_from_knowledge') {
      return {
        nextActionKey: 'answer_from_knowledge',
        nextAction: 'Frage aus der Wissensbasis beantworten',
        shouldAskQuestion: false,
        reason: 'Knowledge-Antwort ist das nächste sichere Verhalten.',
      };
    }

    if (goal === 'solve_problem' && intent === 'support' && context.missingFields.length === 0) {
      return {
        nextActionKey: 'answer_from_knowledge',
        nextAction: 'Frage aus der Wissensbasis beantworten',
        shouldAskQuestion: false,
        reason: 'Supportfall ist hinreichend konkret fuer eine sichere erste Einordnung.',
      };
    }

    if (intent === 'unknown') {
      return {
        nextActionKey: 'ask_clarifying_question',
        nextAction: 'Absicht mit einer kurzen Rückfrage klären: Geht es um Support, Beratung oder Kontaktaufnahme?',
        shouldAskQuestion: true,
        reason: 'Absicht ist noch unklar.',
      };
    }

    if (goal === 'solve_problem' && intent === 'support' && context.missingFields.length > 0) {
      return {
        nextActionKey: 'ask_clarifying_question',
        nextAction: 'Supportproblem mit einer kurzen Rueckfrage eingrenzen',
        shouldAskQuestion: true,
        reason: 'Supportfall braucht zuerst eine knappe Eingrenzung.',
      };
    }

    if (goal === 'recommend_product' && intent === 'product_advice' && context.missingFields.length === 0) {
      return {
        nextActionKey: 'answer_from_knowledge',
        nextAction: 'Frage aus der Wissensbasis beantworten',
        shouldAskQuestion: false,
        reason: 'Produktberatung ist konkret genug fuer eine begrenzte Wissensantwort.',
      };
    }

    if (goal === 'prepare_contact' && intent === 'sales' && context.missingFields.length === 0) {
      return {
        nextActionKey: 'offer_handoff',
        nextAction: 'Menschliche Uebergabe vorbereiten',
        shouldAskQuestion: false,
        reason: 'Kommerzielle Anfrage kann sicher in die menschliche Kontaktuebergabe gehen.',
      };
    }

    return {
      nextActionKey: 'fallback_to_safe_response',
      nextAction: 'Zusammenfassung vorbereiten und nächsten Schritt bestätigen',
      shouldAskQuestion: false,
      reason: 'Keine fehlenden Pflichtfelder erkannt.',
    };
  }
}
