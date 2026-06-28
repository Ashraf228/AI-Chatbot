import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationGoal, ConversationIntent } from './conversation-engine.types';

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
    if (context.missingFields.length > 0 && (goal === 'prepare_contact' || goal === 'collect_request' || goal === 'create_ticket')) {
      return {
        nextAction: labelForField(context.missingFields[0]),
        shouldAskQuestion: true,
        reason: `Nächstes fehlendes Pflichtfeld: ${context.missingFields[0]}.`,
      };
    }

    if (goal === 'answer_from_knowledge') {
      return {
        nextAction: 'Frage aus der Wissensbasis beantworten',
        shouldAskQuestion: false,
        reason: 'Knowledge-Antwort ist das nächste sichere Verhalten.',
      };
    }

    if (intent === 'unknown') {
      return {
        nextAction: 'Absicht mit einer kurzen Rückfrage klären: Geht es um Support, Beratung oder Kontaktaufnahme?',
        shouldAskQuestion: true,
        reason: 'Absicht ist noch unklar.',
      };
    }

    if (goal === 'escalate_human') {
      return {
        nextAction: 'Menschliche Übergabe vorbereiten',
        shouldAskQuestion: false,
        reason: 'Beschwerde oder Eskalationssignal erkannt.',
      };
    }

    return {
      nextAction: 'Zusammenfassung vorbereiten und nächsten Schritt bestätigen',
      shouldAskQuestion: false,
      reason: 'Keine fehlenden Pflichtfelder erkannt.',
    };
  }
}
