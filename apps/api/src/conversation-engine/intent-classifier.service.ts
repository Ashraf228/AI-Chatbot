import { Injectable } from '@nestjs/common';
import { ConversationContext, ConversationIntent } from './conversation-engine.types';

function hasAny(text: string, pattern: RegExp) {
  return pattern.test(text);
}

@Injectable()
export class IntentClassifierService {
  classify(context: ConversationContext): { intent: ConversationIntent; confidence: number; reasons: string[] } {
    const text = context.normalizedText;
    const reasons: string[] = [];

    if (hasAny(text, /\b(beschwerde|beschweren|unzufrieden|reklamation|reklamiere|ärger|aerger|ärgerlich|aergerlich|enttäuscht|enttaeuscht|eskalation|schlechte erfahrung|niemand gemeldet|dringend rückmeldung|dringend rueckmeldung)\b/i)) {
      reasons.push('Beschwerde- oder Eskalationssignal erkannt.');
      return { intent: 'complaint', confidence: 0.8, reasons };
    }

    if (hasAny(text, /\b(termin|meeting|kalender|buchung|beratungsgespräch|beratungsgespraech)\b/i)) {
      reasons.push('Terminbegriff erkannt.');
      return { intent: 'appointment', confidence: 0.78, reasons };
    }

    if (hasAny(text, /\b(ticket|supportfall)\b/i) && hasAny(text, /\b(melden|erstellen|anlegen|aufmachen|öffnen|oeffnen)\b/i)) {
      reasons.push('Explizite Ticketabsicht erkannt.');
      return { intent: 'ticket', confidence: 0.82, reasons };
    }

    if (hasAny(text, /\b(hilfe|fehler|fehlermeldung|störung|stoerung|defekt|problem|funktioniert nicht|geht nicht|kann nicht|vpn|outlook|drucker|login|zugriff|ausfall|passwort|mfa)\b/i)) {
      reasons.push('Support- oder Problembegriff erkannt.');
      return { intent: 'support', confidence: 0.8, reasons };
    }

    if (hasAny(text, /\b(welches produkt|welche lösung|welche loesung|was empfehlen|empfehlung|produktberatung|produktvergleich|welche variante|passt für|passt fuer|sinnvoll für|sinnvoll fuer)\b/i)) {
      reasons.push('Produktberatungssignal erkannt.');
      return { intent: 'product_advice', confidence: 0.78, reasons };
    }

    if (hasAny(text, /\b(preis|preise|kosten|kostet|angebot|kaufen|bestellen|vertrag|demo buchen|kontakt aufnehmen|konkrete anfrage)\b/i)) {
      reasons.push('Produkt-, Preis- oder Angebotsbegriff erkannt.');
      return { intent: 'sales', confidence: 0.72, reasons };
    }

    if (hasAny(text, /\b(mensch|mitarbeiter|rückruf|rueckruf|zurückgerufen|zurueckgerufen|zurückrufen|zurueckrufen|anrufen|kontakt|melden|weiterleiten|eskalieren)\b/i)) {
      reasons.push('Kontakt- oder Übergabewunsch erkannt.');
      return { intent: 'handoff', confidence: 0.82, reasons };
    }

    if (hasAny(text, /\b(weiß nicht genau|weiss nicht genau|unklar|keine ahnung|nicht sicher|was ich brauche|was wir brauchen)\b/i)) {
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
