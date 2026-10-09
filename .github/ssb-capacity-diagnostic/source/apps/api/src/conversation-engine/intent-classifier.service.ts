import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationIntent } from './conversation-engine.types';
import { getRoutingSignals } from './routing-signals';

function hasAny(text: string, pattern: RegExp) {
  return pattern.test(text);
}

@Injectable()
export class IntentClassifierService {
  classify(context: ConversationContext): { intent: ConversationIntent; confidence: number; reasons: string[] } {
    const text = context.normalizedText;
    const reasons: string[] = [];
    const signals = getRoutingSignals(text);

    if (signals.humanIdentityQuestion) {
      reasons.push('Identitaetsfrage erkannt; keine menschliche Uebergabe behaupten.');
      return { intent: 'unknown', confidence: 0.9, reasons };
    }

    if (signals.complaintSignal || (signals.explicitHumanRequest && hasAny(signals.text, /\b(manager|weitergeben|weiterleiten)\b/i))) {
      reasons.push('Beschwerde- oder Eskalationssignal erkannt.');
      return { intent: 'complaint', confidence: 0.8, reasons };
    }

    if (signals.forbiddenPrivacyExecutionRequest || signals.legalFinalityRequest) {
      reasons.push('Verbotene Privacy-/Execution-Anfrage erkannt.');
      return { intent: 'unknown', confidence: 0.9, reasons };
    }

    if (signals.forbiddenOperationalRequest) {
      reasons.push('Verbotene operative Anfrage erkannt; als Support-/Escalation-Fall behandeln.');
      return { intent: 'support', confidence: 0.9, reasons };
    }

    if (signals.ambiguousAppointmentPing) {
      reasons.push('Sehr knapper Terminbegriff erkannt; Absicht bleibt unklar.');
      return { intent: 'unknown', confidence: 0.6, reasons };
    }

    if (signals.appointmentSignal || hasAny(text, /\b(termin|meeting|kalender|buchung|beratungsgespräch|beratungsgespraech)\b/i)) {
      reasons.push('Terminbegriff erkannt.');
      return { intent: 'appointment', confidence: 0.78, reasons };
    }

    if (signals.ticketRequest && !signals.supportSignal) {
      reasons.push('Explizite Ticketabsicht erkannt.');
      return { intent: 'ticket', confidence: 0.82, reasons };
    }

    if (signals.supportSignal || (signals.explicitHumanRequest && !signals.callbackRequest) || signals.ticketRequest || signals.sensitiveCredentialMention) {
      reasons.push('Support- oder Problembegriff erkannt.');
      return { intent: 'support', confidence: 0.8, reasons };
    }

    if (signals.productAdviceSignal || hasAny(text, /\b(welches produkt|welche lösung|welche loesung|was empfehlen|empfehlung|produktberatung|produktvergleich|welche variante|passt für|passt fuer|sinnvoll für|sinnvoll fuer)\b/i)) {
      reasons.push('Produktberatungssignal erkannt.');
      return { intent: 'product_advice', confidence: 0.78, reasons };
    }

    if (signals.salesSignal || hasAny(text, /\b(preis|preise|kosten|kostet|angebot|kaufen|bestellen|vertrag|demo buchen|kontakt aufnehmen|konkrete anfrage)\b/i)) {
      reasons.push('Produkt-, Preis- oder Angebotsbegriff erkannt.');
      return { intent: 'sales', confidence: 0.72, reasons };
    }

    if (signals.callbackRequest || hasAny(text, /\b(mensch|mitarbeiter|rückruf|rueckruf|zurückgerufen|zurueckgerufen|zurückrufen|zurueckrufen|anrufen|kontakt|melden|weiterleiten|eskalieren)\b/i)) {
      reasons.push('Kontakt- oder Übergabewunsch erkannt.');
      return { intent: 'handoff', confidence: 0.82, reasons };
    }

    if (signals.ambiguousNeedSignal || hasAny(text, /\b(weiß nicht genau|weiss nicht genau|unklar|keine ahnung|nicht sicher|was ich brauche|was wir brauchen)\b/i)) {
      reasons.push('Unklarer Bedarf erkannt.');
      return { intent: 'unknown', confidence: 0.62, reasons };
    }

    if (text.endsWith('?') || hasAny(text, /\b(was|wie|warum|wann|wo|welche|kann|kostet)\b/i)) {
      reasons.push('Frageform erkannt.');
      return { intent: 'question', confidence: 0.7, reasons };
    }

    reasons.push('Keine eindeutige Absicht erkannt.');
    return { intent: 'unknown', confidence: 0.35, reasons };
  }
}
