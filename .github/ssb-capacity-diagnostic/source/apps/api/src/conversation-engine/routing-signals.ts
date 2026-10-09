function normalizeForSignals(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export type RoutingSignals = {
  text: string;
  humanIdentityQuestion: boolean;
  explicitHumanRequest: boolean;
  complaintSignal: boolean;
  supportSignal: boolean;
  ticketRequest: boolean;
  forwardingPreference: boolean;
  callbackRequest: boolean;
  appointmentSignal: boolean;
  ambiguousAppointmentPing: boolean;
  productAdviceSignal: boolean;
  salesSignal: boolean;
  ambiguousNeedSignal: boolean;
  forbiddenOperationalRequest: boolean;
  forbiddenPrivacyExecutionRequest: boolean;
  legalFinalityRequest: boolean;
  sensitiveCredentialMention: boolean;
};

export function getRoutingSignals(value: string): RoutingSignals {
  const text = normalizeForSignals(value);
  const humanIdentityQuestion = /^(bist du( ein)? mensch|bist du menschlich|sprich ich mit einem menschen)\??$/.test(text);

  const complaintSignal = includesAny(text, [
    'beschwerde',
    'beschweren',
    'unzufrieden',
    'reklamation',
    'reklamiere',
    'aerger',
    'aergerlich',
    'enttaeuscht',
    'nichts brauchbares',
    'niemand gemeldet',
    'schlechte erfahrung',
    'versprochen',
    'manager',
    'in aussicht gestellt',
    'kann ich nichts anfangen',
    'will das geklaert haben',
    'will das geklart haben',
  ]);

  const explicitHumanRequest = includesAny(text, [
    'echten menschen',
    'echte person',
    'mensch',
    'mitarbeiter',
    'manager',
    'weitergeben',
    'weiterleiten',
    'eskalieren',
    'eskalation',
    'jemand soll sich melden',
    'richtige weiterleitung',
  ]);

  const callbackRequest = includesAny(text, [
    'rueckruf',
    'zurueckruf',
    'zurueckrufen',
    'zurueckgerufen',
    'anrufen',
    'kontakt aufnehmen',
  ]);

  const forwardingPreference = includesAny(text, [
    'richtige weiterleitung',
    'weiterleitung',
    'weitergeben',
    'weiterleiten',
    'wenn es nicht direkt loesbar ist',
    'wenn es nicht direkt lösbar ist',
  ]);

  const ticketRequest = text.includes('ticket') &&
    includesAny(text, ['erstelle', 'erstellen', 'anlegen', 'aufmachen', 'oeffnen', 'eroeffnen']);

  const supportSignal = includesAny(text, [
    'hilfe',
    'fehler',
    'fehlermeldung',
    'stoerung',
    'problem',
    'funktioniert nicht',
    'geht nicht',
    'geht nichts mehr',
    'login',
    'kennwort',
    'passwort',
    'zugriff',
    'dashboard',
    'komplett weiss',
    'bleibt weiss',
    'white screen',
    'white',
    'benachrichtigung',
    'notifications',
    'import',
    'mobil',
    'menuepunkte',
    'rollenaenderung',
    'rolle',
    'api-schluessel',
    'api key',
    'api-key',
    'rein',
  ]);

  const appointmentSignal = !/^(termin|\s*termin\?)$/.test(text) && includesAny(text, [
    'termin vereinbaren',
    'termin buchen',
    'termin moeglich',
    'meeting',
    'beratungsgespraech',
    'beratungsgesprach',
    'consultation',
    'sprechen',
    'abstimmungstermin',
    'workshop',
  ]);

  const ambiguousAppointmentPing = /^(termin|\s*termin\?)$/.test(text);

  const productAdviceSignal = includesAny(text, [
    'welches produkt',
    'welche loesung',
    'was empfehlen',
    'empfehlung',
    'produktberatung',
    'produktvergleich',
    'welche variante',
    'passt besser',
    'passt fuer',
    'passt fuer uns',
    'support-team',
    'beratung oder support',
    'support oder beratung',
  ]);

  const salesSignal = includesAny(text, [
    'preis',
    'preise',
    'kosten',
    'kostet',
    'angebot',
    'budget',
    'roi',
    'rechnet sich',
    'starten',
    'wenn wir uns entscheiden',
    'procurement',
    'beschaffung',
    'ansprechperson',
    'mehrere teams',
    'mehrere team',
  ]);

  const ambiguousNeedSignal = includesAny(text, [
    'weiss nicht genau',
    'unklar',
    'keine ahnung',
    'nicht sicher',
    'was ich brauche',
    'was wir brauchen',
    'ich brauche etwas',
  ]);

  const forbiddenOperationalRequest = includesAny(text, [
    'query runner',
    'produktionsdaten',
    'production data',
    'live ausrollen',
    'live deploy',
    'deploy',
    'monitoring einrichten',
    'alerting einrichten',
    'backup verification',
    'backup verifikation',
  ]);

  const forbiddenPrivacyExecutionRequest = includesAny(text, [
    'dsar-export',
    'dsar export',
    'daten direkt loeschen',
    'daten loeschen lassen',
    'export anstossen',
  ]);

  const legalFinalityRequest = includesAny(text, [
    'rechtlich vollstaendig konform',
    'rechtlich vollständig konform',
    'verbindlich bestaetigen',
    'verbindlich bestätigen',
  ]);

  const sensitiveCredentialMention = includesAny(text, [
    'api-schluessel',
    'api key',
    'api-key',
    'kennwort',
    'passwort',
    'secret',
    'token',
  ]);

  return {
    text,
    humanIdentityQuestion,
    explicitHumanRequest,
    complaintSignal,
    supportSignal,
    ticketRequest,
    forwardingPreference,
    callbackRequest,
    appointmentSignal,
    ambiguousAppointmentPing,
    productAdviceSignal,
    salesSignal,
    ambiguousNeedSignal,
    forbiddenOperationalRequest,
    forbiddenPrivacyExecutionRequest,
    legalFinalityRequest,
    sensitiveCredentialMention,
  };
}
