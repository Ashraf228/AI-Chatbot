import type { ItSupportModuleConfig } from '../../site-modules/module-configs';

export type PendingTicketStatus =
  | 'triage'
  | 'solution_offered'
  | 'ticket_offered'
  | 'collecting'
  | 'ready_to_create'
  | 'created'
  | 'cancelled'
  | 'resolved';

export type PendingTicketForwardingStatus = 'queued' | 'not_configured' | 'failed' | 'unknown';

export type PendingTicketUrgency = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type PendingTicketImpact =
  | 'single_user'
  | 'multiple_users'
  | 'department'
  | 'company_wide'
  | 'unknown';

export type PendingTicketState = {
  status: PendingTicketStatus;
  issueType?: string;
  affectedSystem?: string;
  summary?: string;
  description?: string;
  urgency?: PendingTicketUrgency;
  impact?: PendingTicketImpact;
  affectedUsers?: string;
  device?: string;
  operatingSystem?: string;
  errorMessage?: string;
  alreadyTried?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  company?: string;
  department?: string;
  location?: string;
  ticketConsent?: boolean;
  solutionAttemptCount?: number;
  attemptedSolutions?: string[];
  lastAssistantAsk?:
    | 'solution_check'
    | 'ticket_confirmation'
    | 'ticket_final_confirmation'
    | 'reporter_contact'
    | 'impact'
    | 'affected_system'
    | 'description'
    | 'error_message';
  nextExpectedField?: string;
  missingFields?: string[];
  priority?: PendingTicketUrgency;
  createdTicketId?: string;
  forwardingStatus?: PendingTicketForwardingStatus;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
};

const ISSUE_KEYWORDS: Array<{ type: string; system: string; keywords: string[] }> = [
  { type: 'password', system: 'Passwort/Login', keywords: ['passwort', 'kennwort', 'konto gesperrt', 'login blockiert'] },
  { type: 'mfa', system: 'MFA/2FA', keywords: ['mfa', '2fa', 'authenticator', 'mfa gesperrt', '2fa gesperrt'] },
  { type: 'vpn', system: 'VPN', keywords: ['vpn'] },
  { type: 'network', system: 'WLAN/Netzwerk', keywords: ['wlan', 'wifi', 'netzwerk', 'lan', 'internet', 'netzausfall'] },
  { type: 'outlook', system: 'Outlook', keywords: ['outlook'] },
  { type: 'email', system: 'E-Mail', keywords: ['e-mail', 'email', 'mail', 'postfach'] },
  { type: 'printer', system: 'Drucker', keywords: ['drucker', 'printer'] },
  { type: 'access', system: 'Zugriff/Berechtigung', keywords: ['zugriff', 'berechtigung', 'freigabe', 'anmeldung', 'login'] },
  { type: 'hardware', system: 'Gerät/Hardware', keywords: ['gerät', 'geraet', 'laptop', 'pc', 'notebook', 'monitor', 'hardware'] },
  { type: 'software', system: 'Software', keywords: ['software', 'programm', 'app', 'anwendung'] },
  { type: 'security', system: 'IT-Sicherheit', keywords: ['sicherheitsvorfall', 'phishing', 'malware', 'virus', 'ransomware', 'konto übernommen', 'konto uebernommen'] },
  { type: 'server', system: 'Server/System', keywords: ['server', 'systemausfall', 'serverausfall'] },
];

const IT_SUPPORT_KEYWORDS = [
  'passwort',
  'kennwort',
  'mfa',
  '2fa',
  'vpn',
  'wlan',
  'wifi',
  'netzwerk',
  'outlook',
  'e-mail',
  'email',
  'drucker',
  'printer',
  'gerät',
  'geraet',
  'laptop',
  'pc',
  'software',
  'zugriff',
  'berechtigung',
  'login',
  'anmeldung',
  'server',
  'systemausfall',
  'datenverlust',
  'sicherheitsvorfall',
  'phishing',
  'malware',
  'virus',
  'ransomware',
  'konto gesperrt',
  'login blockiert',
];

const CRITICAL_KEYWORDS = [
  'datenverlust',
  'sicherheitsvorfall',
  'phishing',
  'malware',
  'ransomware',
  'serverausfall',
  'netzwerkausfall',
  'komplett down',
  'alles down',
  'firma steht',
  'konto übernommen',
  'konto uebernommen',
  'login blockiert',
  'mfa gesperrt',
  '2fa gesperrt',
];

export function hasItSupportSignal(text: string): boolean {
  return matchesKeyword(text, IT_SUPPORT_KEYWORDS);
}

export function isTerminalPendingTicketStatus(status?: string): boolean {
  return status === 'created' || status === 'resolved' || status === 'cancelled';
}

export function shouldStartNewItSupportContext(input: {
  text: string;
  pendingTicket?: PendingTicketState | null;
}): boolean {
  if (!input.pendingTicket || !isTerminalPendingTicketStatus(input.pendingTicket.status)) {
    return false;
  }

  if (hasTerminalStateSmalltalk(input.text)) {
    return false;
  }

  return (
    hasItSupportSignal(input.text) ||
    hasCriticalItIncident(input.text) ||
    hasSecurityIncident(input.text)
  );
}

export function hasCriticalItIncident(text: string, escalationKeywords: string[] = []): boolean {
  const normalized = normalizeText(text);
  return (
    matchesKeyword(text, [...CRITICAL_KEYWORDS, ...escalationKeywords]) ||
    /\b(komplettes?\s+netzwerk|ganzes\s+netzwerk|netzwerk\s+ist\s+down|netzwerk.*down|server\s+ist\s+down|server.*down|alles.*down)\b/i.test(
      normalized,
    )
  );
}

export function hasSecurityIncident(text: string): boolean {
  return matchesKeyword(text, ['sicherheitsvorfall', 'phishing', 'malware', 'virus', 'ransomware', 'konto übernommen', 'konto uebernommen']);
}

export function hasExplicitTicketRequest(text: string): boolean {
  return /\b(ticket|support-ticket|supportfall|fall)\s*(oeffnen|öffnen|erstellen|anlegen|aufmachen)\b/i.test(text) ||
    /\b(oeffne|öffne|erstelle|mach|mache)\s*(bitte\s*)?(ein\s*)?(ticket|supportfall)\b/i.test(text) ||
    /\b(ticket|supportfall|support-ticket)\b/i.test(text) ||
    /\b(leite|weiterleiten|weitergeben|eskalieren)\b.*\b(it|support|mitarbeiter|mensch)\b/i.test(text) ||
    /\b(it|support|mitarbeiter|mensch)\b.*\b(leite|weiterleiten|weitergeben|eskalieren|kontaktieren|sprechen)\b/i.test(text);
}

export function hasItSupportHandoffRequest(text: string): boolean {
  return /\b(mitarbeiter|menschlicher support|mensch|support kontaktieren|it kontaktieren|it-support kontaktieren|support sprechen|mit einem menschen sprechen|mit einem mitarbeiter sprechen)\b/i.test(
    normalizeText(text),
  );
}

export function hasTicketConfirmationYes(text: string, ticket?: PendingTicketState | null): boolean {
  if (
    ticket &&
    ticket.lastAssistantAsk !== 'ticket_confirmation' &&
    ticket.lastAssistantAsk !== 'ticket_final_confirmation' &&
    ticket.status !== 'ticket_offered' &&
    ticket.status !== 'ready_to_create'
  ) {
    return false;
  }
  return /^(ja|jap|yes|gerne|gern|bitte|mach das|mache das|ticket öffnen|ticket oeffnen|ticket erstellen|supportfall öffnen|supportfall oeffnen|leite es weiter|weiterleiten|support informieren)\b/i.test(
    normalizeText(text),
  );
}

export function hasTicketConfirmationNo(text: string): boolean {
  return /^(nein|nope|nicht nötig|nicht noetig|kein ticket|passt erstmal|erstmal nicht|abbrechen|stop|stopp)\b/i.test(normalizeText(text));
}

export function hasTicketCollectionAbort(text: string): boolean {
  return /\b(abbrechen|doch kein ticket|kein ticket|stop|stopp|nicht weiter)\b/i.test(normalizeText(text));
}

export function hasSolutionFailedReply(text: string, ticket?: PendingTicketState | null): boolean {
  if (ticket && ticket.lastAssistantAsk !== 'solution_check') {
    return false;
  }
  return /^(nein|nope)\b/i.test(normalizeText(text)) ||
    /\b(hat nicht geholfen|funktioniert immer noch nicht|geht immer noch nicht|klappt nicht|keine besserung|problem besteht weiter|immer noch)\b/i.test(
      normalizeText(text),
    );
}

export function hasSolutionWorkedReply(text: string, ticket?: PendingTicketState | null): boolean {
  if (ticket && ticket.lastAssistantAsk !== 'solution_check') {
    return false;
  }
  return /^(ja|danke|erledigt)\b/i.test(normalizeText(text)) ||
    /\b(hat geholfen|funktioniert wieder|geht wieder|passt|passt jetzt|ist behoben)\b/i.test(normalizeText(text));
}

export function buildItSupportAnswerGuide(input: {
  ticket?: PendingTicketState | null;
  config?: Partial<ItSupportModuleConfig>;
  knowledgeAvailable?: boolean;
} = {}): string {
  const ticket = input.ticket;
  const knowledgeLine = input.knowledgeAvailable === false
    ? 'Wenn keine passende Wissensbasis vorhanden ist, sage das transparent und behaupte keine interne Regel.'
    : 'Nutze zuerst die verifizierte Wissensbasis und antworte daraus, wenn passende Informationen vorhanden sind.';
  const ticketContext = ticket
    ? [
        'Aktueller Supportfall:',
        ticket.issueType ? `- Typ: ${ticket.issueType}` : '',
        ticket.affectedSystem ? `- Betroffenes System: ${ticket.affectedSystem}` : '',
        ticket.summary || ticket.description ? `- Zusammenfassung: ${ticket.summary || ticket.description}` : '',
        ticket.urgency || ticket.priority ? `- Dringlichkeit/Priorität: ${ticket.urgency || ticket.priority}` : '',
      ].filter(Boolean).join('\n')
    : '';

  return [
    'IT-Support-Guidance: Du bist ein IT-First-Level-Support-Agent.',
    knowledgeLine,
    'Wenn keine passende Wissensbasis vorhanden ist, erfinde keine kundenspezifischen Richtlinien, internen Prozesse oder garantierten Lösungen.',
    'Nutze als Fallback nur sichere allgemeine First-Level-Schritte und kennzeichne sie als allgemeine Hinweise.',
    'Gib maximal 3-5 sichere Schritte und frage am Ende: "Hat das geholfen? Falls nicht, kann ich ein Support-Ticket öffnen."',
    'Frage niemals nach Passwörtern, MFA-Codes, API-Keys, Tokens, Secrets oder Admin-Zugangsdaten.',
    'Gib keine riskanten PowerShell-, Terminal-, Registry- oder Löschbefehle und keine Security-Bypass-Anleitungen aus, außer sie stammen ausdrücklich aus verifizierter Wissensbasis.',
    'Tickets nur nach klarer Anfrage oder Bestätigung vorbereiten oder erstellen.',
    'Bei Phishing, Malware, Ransomware, Datenverlust, Kontoübernahme, Komplettausfall oder Login-/MFA-Blockade keine langen Experimente; Ticket/Eskalation anbieten.',
    input.config?.safeTroubleshootingInstruction || '',
    input.config?.handoffInstruction || '',
    ticketContext,
  ].filter(Boolean).join('\n');
}

export function buildSafeFallbackTroubleshootingSteps(issueType?: string, affectedSystem?: string): string[] {
  const normalized = normalizeText(issueType || affectedSystem || 'generic_it');
  if (normalized.includes('password') || normalized.includes('passwort') || normalized.includes('kennwort')) {
    return [
      'Self-Service-Passwortportal nutzen, falls eines vorhanden ist.',
      'Prüfen, ob Caps Lock und Tastaturlayout korrekt sind.',
      'Keine Passwörter im Chat senden.',
      'Bei Kontosperre ein Support-Ticket öffnen.',
    ];
  }
  if (normalized.includes('mfa') || normalized.includes('2fa')) {
    return [
      'Gerät und Uhrzeit prüfen.',
      'Authenticator-App neu öffnen.',
      'Push erneut versuchen.',
      'Keine MFA-Codes im Chat senden.',
      'Bei gesperrter MFA direkt ein Ticket öffnen.',
    ];
  }
  if (normalized.includes('vpn')) {
    return [
      'Internetverbindung prüfen.',
      'VPN-Client neu starten.',
      'Gerät neu starten.',
      'Fehlermeldung notieren.',
      'Wenn es danach nicht funktioniert: Ticket öffnen.',
    ];
  }
  if (normalized.includes('network') || normalized.includes('netzwerk') || normalized.includes('wlan') || normalized.includes('wifi')) {
    return [
      'WLAN- oder LAN-Verbindung prüfen.',
      'Router oder Access Point bei Unternehmensgeräten nicht selbstständig zurücksetzen.',
      'Anderes Netzwerk testen, falls erlaubt.',
      'Bei mehreren betroffenen Nutzern Ticket oder Eskalation öffnen.',
    ];
  }
  if (normalized.includes('email') || normalized.includes('e-mail') || normalized.includes('outlook')) {
    return [
      'Outlook oder Webmail testen.',
      'Internetverbindung prüfen.',
      'Outlook neu starten.',
      'Fehlermeldung notieren.',
      'Keine Zugangsdaten teilen.',
    ];
  }
  if (normalized.includes('printer') || normalized.includes('drucker')) {
    return [
      'Druckerstatus prüfen.',
      'Papier und Toner prüfen.',
      'Druckauftrag löschen und erneut senden.',
      'Gerät neu starten.',
      'Fehlermeldung notieren.',
    ];
  }
  if (normalized.includes('access') || normalized.includes('zugriff') || normalized.includes('berechtigung')) {
    return [
      'Betroffene Anwendung oder Ressource nennen.',
      'Fehlermeldung notieren.',
      'Keine fremden Zugangsdaten nutzen.',
      'Ticket mit benötigter Berechtigung öffnen.',
    ];
  }
  if (normalized.includes('hardware') || normalized.includes('gerät') || normalized.includes('geraet')) {
    return [
      'Gerät neu starten.',
      'Strom, Netzteil und Docking prüfen.',
      'Fehlermeldung oder Verhalten beschreiben.',
      'Bei Defekt ein Ticket öffnen.',
    ];
  }
  if (normalized.includes('software') || normalized.includes('app') || normalized.includes('anwendung')) {
    return [
      'Anwendung neu starten.',
      'Gerät neu starten.',
      'Version und Fehlermeldung notieren.',
      'Keine unbekannten Installer ausführen.',
    ];
  }
  if (normalized.includes('security') || normalized.includes('sicherheit') || normalized.includes('phishing') || normalized.includes('malware') || normalized.includes('virus') || normalized.includes('ransomware')) {
    return [
      'Keine Links oder Anhänge öffnen.',
      'Gerät bei Malware-Verdacht nicht weiter nutzen.',
      'Keine Passwörter eingeben.',
      'Sofort Ticket oder Eskalation anbieten.',
    ];
  }
  return [
    'Problem kurz eingrenzen.',
    'Fehlermeldung notieren.',
    'Seit wann es auftritt, wen es betrifft und welches System betroffen ist erfassen.',
    'Ticket anbieten, wenn es nicht lösbar ist.',
  ];
}

export function inferIssueType(text: string): string | undefined {
  for (const entry of ISSUE_KEYWORDS) {
    if (matchesKeyword(text, entry.keywords)) {
      return entry.type;
    }
  }
  return hasItSupportSignal(text) ? 'generic_it' : undefined;
}

export function inferAffectedSystem(text: string): string | undefined {
  for (const entry of ISSUE_KEYWORDS) {
    if (matchesKeyword(text, entry.keywords)) {
      return entry.system;
    }
  }
  return undefined;
}

export function inferImpact(text: string): PendingTicketImpact | undefined {
  const normalized = normalizeText(text);
  if (/\b(nur mich|nur ich|ein nutzer|ein user|single user|mein laptop|mein pc)\b/i.test(normalized)) {
    return 'single_user';
  }
  if (/\b(mehrere nutzer|mehrere user|viele nutzer|mehrere personen|team)\b/i.test(normalized)) {
    return 'multiple_users';
  }
  if (/\b(abteilung|department|bereich)\b/i.test(normalized)) {
    return 'department';
  }
  if (/\b(alle|ganzes unternehmen|firma|company wide|komplett down|komplettes netzwerk|ganzes netzwerk|netzwerk ist down|alles down|firma steht|unternehmen)\b/i.test(normalized)) {
    return 'company_wide';
  }
  return undefined;
}

export function inferUrgency(text: string): PendingTicketUrgency | undefined {
  const normalized = normalizeText(text);
  if (hasSecurityIncident(normalized) || /\b(kritisch|critical|datenverlust|ransomware)\b/i.test(normalized)) {
    return 'critical';
  }
  if (/\b(dringend|urgent|sofort|komplett down|alles down|firma steht|serverausfall|netzwerkausfall|login blockiert)\b/i.test(normalized)) {
    return 'urgent';
  }
  if (/\b(hoch|wichtig|heute|blockiert|funktioniert nicht)\b/i.test(normalized)) {
    return 'high';
  }
  if (/\b(niedrig|nicht dringend|irgendwann|später|spaeter)\b/i.test(normalized)) {
    return 'low';
  }
  return undefined;
}

export function classifyTicketPriority(ticket: PendingTicketState): PendingTicketUrgency {
  if (ticket.urgency === 'critical' || ticket.priority === 'critical' || ticket.issueType === 'security') {
    return 'critical';
  }
  if (
    ticket.urgency === 'urgent' ||
    ticket.priority === 'urgent' ||
    ticket.impact === 'company_wide' ||
    ticket.issueType === 'server'
  ) {
    return 'urgent';
  }
  if (ticket.urgency === 'high' || ticket.impact === 'department' || ticket.impact === 'multiple_users') {
    return 'high';
  }
  return ticket.urgency === 'low' ? 'low' : 'normal';
}

export function extractItTicketFields(
  message: string,
  previous?: PendingTicketState | null,
): Partial<PendingTicketState> {
  const patch: Partial<PendingTicketState> = {};
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = message.match(/(?:\+?\d[\d\s()./-]{5,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
  const issueType = inferIssueType(message);
  const affectedSystem = inferAffectedSystem(message);
  const impact = inferImpact(message);
  const urgency = inferUrgency(message);
  const operatingSystem = inferOperatingSystem(message);
  const device = inferDevice(message);
  const reporterName = extractReporterName(message);
  const department = message.match(/\b(?:abteilung|department)\s*(?:ist|:)?\s*([A-ZÄÖÜa-zäöüß0-9 -]{2,60})/i)?.[1]?.trim();
  const location = message.match(/\b(?:standort|location|büro|buero)\s*(?:ist|:)?\s*([A-ZÄÖÜa-zäöüß0-9 -]{2,60})/i)?.[1]?.trim();
  const errorMessage = message.match(/\b(?:fehlermeldung|fehler)\s*(?:(?:ist|lautet|:)\s*)?(.{3,160})/i)?.[1]?.trim();
  const alreadyTried = message.match(/\b(?:versucht|probiert|already tried)\s*(?:habe ich|:)?\s*(.{3,160})/i)?.[1]?.trim();
  const description = sanitizeDescription(message);

  if (email) patch.reporterEmail = email;
  if (phone) patch.reporterPhone = phone;
  if (issueType) patch.issueType = issueType;
  if (affectedSystem) patch.affectedSystem = affectedSystem;
  if (impact) patch.impact = impact;
  if (urgency) patch.urgency = urgency;
  if (operatingSystem) patch.operatingSystem = operatingSystem;
  if (device) patch.device = device;
  if (reporterName) patch.reporterName = reporterName;
  if (department) patch.department = cleanSentenceEnd(department);
  if (location) patch.location = cleanSentenceEnd(location);
  if (errorMessage) patch.errorMessage = cleanSentenceEnd(errorMessage);
  if (alreadyTried) patch.alreadyTried = cleanSentenceEnd(alreadyTried);
  if (!previous?.description && description) patch.description = description;
  if (!previous?.summary && description) patch.summary = buildSummary(description, affectedSystem || previous?.affectedSystem);

  return patch;
}

export function mergePendingTicket(
  previous: PendingTicketState | null | undefined,
  patch: Partial<PendingTicketState>,
): PendingTicketState {
  const now = new Date().toISOString();
  const merged: PendingTicketState = {
    status: patch.status || previous?.status || 'triage',
    issueType: patch.issueType || previous?.issueType,
    affectedSystem: patch.affectedSystem || previous?.affectedSystem,
    summary: patch.summary || previous?.summary,
    description: patch.description || previous?.description,
    urgency: patch.urgency || previous?.urgency,
    impact: patch.impact || previous?.impact,
    affectedUsers: patch.affectedUsers || previous?.affectedUsers,
    device: patch.device || previous?.device,
    operatingSystem: patch.operatingSystem || previous?.operatingSystem,
    errorMessage: patch.errorMessage || previous?.errorMessage,
    alreadyTried: patch.alreadyTried || previous?.alreadyTried,
    reporterName: patch.reporterName || previous?.reporterName,
    reporterEmail: patch.reporterEmail || previous?.reporterEmail,
    reporterPhone: patch.reporterPhone || previous?.reporterPhone,
    company: patch.company || previous?.company,
    department: patch.department || previous?.department,
    location: patch.location || previous?.location,
    ticketConsent: typeof patch.ticketConsent === 'boolean' ? patch.ticketConsent : previous?.ticketConsent,
    solutionAttemptCount: patch.solutionAttemptCount ?? previous?.solutionAttemptCount,
    attemptedSolutions: patch.attemptedSolutions || previous?.attemptedSolutions,
    lastAssistantAsk: 'lastAssistantAsk' in patch ? patch.lastAssistantAsk : previous?.lastAssistantAsk,
    nextExpectedField: 'nextExpectedField' in patch ? patch.nextExpectedField : previous?.nextExpectedField,
    missingFields: 'missingFields' in patch ? patch.missingFields : previous?.missingFields,
    priority: patch.priority || previous?.priority,
    createdTicketId: patch.createdTicketId || previous?.createdTicketId,
    forwardingStatus: patch.forwardingStatus || previous?.forwardingStatus,
    startedAt: patch.startedAt || previous?.startedAt || now,
    updatedAt: now,
    completedAt: patch.completedAt || previous?.completedAt,
  };

  merged.priority = classifyTicketPriority(merged);
  return merged;
}

export function getMissingItTicketFields(
  ticket: PendingTicketState,
  requiredFields: string[] = ['description', 'affectedSystem', 'impact', 'reporterEmail'],
): string[] {
  return requiredFields.filter((field) => {
    if (field === 'description') return !ticket.description && !ticket.summary;
    if (field === 'affectedSystem') return !ticket.affectedSystem;
    if (field === 'impact') return !ticket.impact || ticket.impact === 'unknown';
    if (field === 'reporterEmail') return !ticket.reporterEmail;
    if (field === 'reporterPhone') return !ticket.reporterPhone;
    if (field === 'reporterName') return !ticket.reporterName;
    if (field === 'device') return !ticket.device;
    if (field === 'operatingSystem') return !ticket.operatingSystem;
    if (field === 'errorMessage') return !ticket.errorMessage;
    if (field === 'alreadyTried') return !ticket.alreadyTried;
    if (field === 'department') return !ticket.department;
    if (field === 'location') return !ticket.location;
    return !readTicketField(ticket, field);
  });
}

export function buildItTicketMissingFieldQuestion(missing: string[], ticket: PendingTicketState): string {
  const field = missing[0];
  if (field === 'reporterEmail') {
    return 'Unter welcher E-Mail-Adresse kann der IT-Support dich erreichen?';
  }
  if (field === 'reporterPhone') {
    return 'Unter welcher Telefonnummer kann der IT-Support dich bei Rückfragen erreichen?';
  }
  if (field === 'reporterName') {
    return 'Auf welchen Namen soll der IT-Support das Ticket aufnehmen?';
  }
  if (field === 'affectedSystem') {
    return 'Welches System ist betroffen, z. B. VPN, Outlook, WLAN, Drucker oder ein bestimmter Laptop?';
  }
  if (field === 'impact') {
    return 'Sind nur du, mehrere Nutzer, eine Abteilung oder das ganze Unternehmen betroffen?';
  }
  if (field === 'device') {
    return 'Welches Gerät ist betroffen, z. B. Laptop, PC, Drucker oder Smartphone?';
  }
  if (field === 'operatingSystem') {
    return 'Welches Betriebssystem ist betroffen, z. B. Windows, macOS, iOS oder Android?';
  }
  if (field === 'errorMessage') {
    return 'Welche Fehlermeldung wird angezeigt? Bitte ohne Passwörter, MFA-Codes oder vertrauliche Daten.';
  }
  if (field === 'alreadyTried') {
    return 'Was wurde bereits versucht? Bitte nur kurz beschreiben.';
  }
  if (field === 'department') {
    return 'Welche Abteilung ist betroffen?';
  }
  if (field === 'location') {
    return 'An welchem Standort tritt das Problem auf?';
  }

  if (ticket.summary) {
    return `Ich habe bisher erfasst: ${ticket.summary}. Bitte beschreibe kurz, was genau nicht funktioniert und seit wann das Problem besteht.`;
  }
  return 'Bitte beschreibe kurz, was genau nicht funktioniert und seit wann das Problem besteht.';
}

export function buildItTicketOfferAnswer(ticket: PendingTicketState): string {
  const summary = ticket.summary || ticket.description || 'das IT-Problem';
  if (ticket.issueType === 'security' || ticket.priority === 'critical' || ticket.priority === 'urgent') {
    return [
      'Das klingt nach einem kritischen IT-Vorfall.',
      'Bitte gib hier keine Passwörter, MFA-Codes oder vertraulichen Daten ein.',
      `Kurz erfasst: ${summary}.`,
      'Ich kann dafür direkt ein dringendes Support-Ticket öffnen und an den IT-Support weiterleiten. Soll ich das tun?',
    ].join(' ');
  }
  return `Ich habe das Problem kurz erfasst: ${summary}. Soll ich dafür ein Support-Ticket öffnen?`;
}

export function buildItTicketReadyToCreateAnswer(ticket: PendingTicketState): string {
  const lines = [
    'Ich habe die wichtigsten Informationen für das Support-Ticket gesammelt:',
    '',
    `- Problem: ${ticket.description || ticket.summary || 'nicht angegeben'}`,
    `- Betroffenes System: ${ticket.affectedSystem || 'nicht angegeben'}`,
    `- Auswirkung: ${formatImpact(ticket.impact)}`,
    `- Kontakt: ${ticket.reporterEmail || ticket.reporterPhone || ticket.reporterName || 'nicht angegeben'}`,
    `- Priorität: ${formatPriority(ticket.priority)}`,
    '',
    'Soll ich das Ticket jetzt erstellen und an den IT-Support weiterleiten?',
  ];
  return lines.join('\n');
}

export function buildItSupportResolvedAnswer(): string {
  return 'Gut, dann markiere ich das Problem als gelöst. Wenn es wieder auftritt, kann ich ein Ticket aufnehmen.';
}

export function buildItSupportCancelledAnswer(): string {
  return 'Alles klar, ich öffne kein Ticket. Falls das Problem weiter besteht, kann ich später ein Ticket aufnehmen.';
}

export function parsePendingTicketState(value: unknown): PendingTicketState | null {
  const source = asObject(value);
  const status = parseStatus(asString(source.status));
  if (!status) {
    return null;
  }

  return compactPendingTicketState({
    status,
    issueType: asString(source.issueType) || undefined,
    affectedSystem: asString(source.affectedSystem) || undefined,
    summary: asString(source.summary) || undefined,
    description: asString(source.description) || undefined,
    urgency: parseUrgency(asString(source.urgency)),
    impact: parseImpact(asString(source.impact)),
    affectedUsers: asString(source.affectedUsers) || undefined,
    device: asString(source.device) || undefined,
    operatingSystem: asString(source.operatingSystem) || undefined,
    errorMessage: asString(source.errorMessage) || undefined,
    alreadyTried: asString(source.alreadyTried) || undefined,
    reporterName: asString(source.reporterName) || undefined,
    reporterEmail: asString(source.reporterEmail) || undefined,
    reporterPhone: asString(source.reporterPhone) || undefined,
    company: asString(source.company) || undefined,
    department: asString(source.department) || undefined,
    location: asString(source.location) || undefined,
    ticketConsent: typeof source.ticketConsent === 'boolean' ? source.ticketConsent : undefined,
    solutionAttemptCount: Number.isFinite(Number(source.solutionAttemptCount))
      ? Number(source.solutionAttemptCount)
      : undefined,
    attemptedSolutions: asStringArray(source.attemptedSolutions),
    lastAssistantAsk: parseLastAssistantAsk(asString(source.lastAssistantAsk)),
    nextExpectedField: asString(source.nextExpectedField) || undefined,
    missingFields: asStringArray(source.missingFields),
    priority: parseUrgency(asString(source.priority)),
    createdTicketId: asString(source.createdTicketId) || undefined,
    forwardingStatus: parseForwardingStatus(asString(source.forwardingStatus)),
    startedAt: asString(source.startedAt) || undefined,
    updatedAt: asString(source.updatedAt) || undefined,
    completedAt: asString(source.completedAt) || undefined,
  });
}

export function compactPendingTicketState(ticket: PendingTicketState): PendingTicketState {
  const compact = Object.fromEntries(
    Object.entries(ticket).filter(([key, value]) => {
      if (key === 'status') return true;
      if (key === 'missingFields') return Array.isArray(value);
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    }),
  ) as PendingTicketState;
  return compact;
}

export function buildCreateTicketInputFromPendingTicket(
  ticket: PendingTicketState,
  options: {
    conversationId?: string;
    tenantId?: string;
    siteId?: string;
  } = {},
): Record<string, unknown> {
  const priority = ticket.priority || classifyTicketPriority(ticket);
  const shortSummary = redactSensitiveText(ticket.summary || ticket.description || ticket.affectedSystem || 'IT-Support-Ticket');
  const subjectBase = ticket.affectedSystem
    ? `IT-Support: ${ticket.affectedSystem} - ${shortSummary}`
    : `IT-Support: ${shortSummary}`;
  const metadata = dropEmpty({
    sourceAgent: 'it-support-agent',
    pendingTicketStatus: ticket.status,
    solutionAttemptCount: ticket.solutionAttemptCount,
    attemptedSolutions: ticket.attemptedSolutions || [],
    lastAssistantAsk: ticket.lastAssistantAsk,
    tenantId: options.tenantId,
    siteId: options.siteId,
  });

  return deepRedactSensitiveValues(dropEmpty({
    subject: truncateText(subjectBase, 200),
    title: truncateText(subjectBase, 200),
    description: buildTicketDescription(ticket),
    category: 'it_support',
    priority,
    urgency: ticket.urgency,
    impact: ticket.impact,
    issueType: ticket.issueType,
    affectedSystem: ticket.affectedSystem,
    affectedUsers: ticket.affectedUsers,
    customerEmail: ticket.reporterEmail,
    customerName: ticket.reporterName,
    reporterName: ticket.reporterName,
    reporterEmail: ticket.reporterEmail,
    reporterPhone: ticket.reporterPhone,
    company: ticket.company,
    department: ticket.department,
    location: ticket.location,
    device: ticket.device,
    operatingSystem: ticket.operatingSystem,
    errorMessage: ticket.errorMessage ? truncateText(redactSensitiveText(ticket.errorMessage), 500) : undefined,
    alreadyTried: ticket.alreadyTried ? truncateText(redactSensitiveText(ticket.alreadyTried), 500) : undefined,
    source: 'chat',
    conversationId: options.conversationId,
    metadata,
  })) as Record<string, unknown>;
}

function inferOperatingSystem(text: string) {
  if (/\bwindows\b/i.test(text)) return 'Windows';
  if (/\bmacos|mac os|macbook|ios\b/i.test(text)) return 'macOS/iOS';
  if (/\bandroid\b/i.test(text)) return 'Android';
  if (/\blinux\b/i.test(text)) return 'Linux';
  return undefined;
}

function inferDevice(text: string) {
  const match = text.match(/\b(windows\s+)?(laptop|notebook|pc|drucker|printer|smartphone|handy|tablet|macbook)\b/i)?.[0];
  return match ? cleanSentenceEnd(match) : undefined;
}

function extractReporterName(text: string) {
  const explicit = text.match(/\b(?:mein name ist|ich hei(?:ß|ss)e|name)\s*:?\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i)?.[1];
  return explicit ? cleanSentenceEnd(explicit) : undefined;
}

function sanitizeDescription(text: string) {
  const stripped = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?\d[\d\s()./-]{5,}\d)/g, '')
    .replace(/\b(nur mich|mehrere nutzer|mehrere user|abteilung|ganzes unternehmen|windows|macos|laptop|pc)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
    .trim();

  if (stripped.length < 8 || hasTicketConfirmationYes(stripped) || hasTicketConfirmationNo(stripped)) {
    return undefined;
  }
  return cleanSentenceEnd(stripped);
}

function buildSummary(description: string, affectedSystem?: string) {
  return affectedSystem ? `${affectedSystem}: ${description}` : description;
}

function formatImpact(value: PendingTicketImpact | undefined) {
  if (value === 'single_user') return 'ein Nutzer';
  if (value === 'multiple_users') return 'mehrere Nutzer';
  if (value === 'department') return 'eine Abteilung';
  if (value === 'company_wide') return 'das ganze Unternehmen';
  return 'nicht angegeben';
}

function formatPriority(value: PendingTicketUrgency | undefined) {
  if (value === 'critical') return 'kritisch';
  if (value === 'urgent') return 'dringend';
  if (value === 'high') return 'hoch';
  if (value === 'low') return 'niedrig';
  return 'normal';
}

function readTicketField(ticket: PendingTicketState, field: string) {
  return (ticket as Record<string, unknown>)[field];
}

function parseStatus(value: string): PendingTicketStatus | undefined {
  if (
    [
      'triage',
      'solution_offered',
      'ticket_offered',
      'collecting',
      'ready_to_create',
      'created',
      'cancelled',
      'resolved',
    ].includes(value)
  ) {
    return value as PendingTicketStatus;
  }
  return undefined;
}

function parseUrgency(value: string): PendingTicketUrgency | undefined {
  if (['low', 'normal', 'high', 'urgent', 'critical'].includes(value)) {
    return value as PendingTicketUrgency;
  }
  return undefined;
}

function parseImpact(value: string): PendingTicketImpact | undefined {
  if (['single_user', 'multiple_users', 'department', 'company_wide', 'unknown'].includes(value)) {
    return value as PendingTicketImpact;
  }
  return undefined;
}

function parseLastAssistantAsk(value: string): PendingTicketState['lastAssistantAsk'] | undefined {
  if (
    [
      'solution_check',
      'ticket_confirmation',
      'ticket_final_confirmation',
      'reporter_contact',
      'impact',
      'affected_system',
      'description',
      'error_message',
    ].includes(value)
  ) {
    return value as PendingTicketState['lastAssistantAsk'];
  }
  return undefined;
}

function parseForwardingStatus(value: string): PendingTicketForwardingStatus | undefined {
  if (['queued', 'not_configured', 'failed', 'unknown'].includes(value)) {
    return value as PendingTicketForwardingStatus;
  }
  return undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => asString(entry)).filter(Boolean) : undefined;
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function normalizeKeyword(value: string) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keywords: string[]) {
  const normalized = normalizeKeyword(text);
  return keywords.some((keyword) => {
    const candidate = normalizeKeyword(keyword);
    if (!candidate) {
      return false;
    }
    return candidate.includes(' ')
      ? normalized.includes(candidate)
      : new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i').test(normalized);
  });
}

function cleanSentenceEnd(value: string) {
  return value.replace(/[,.!?;:]+$/g, '').trim();
}

function buildTicketDescription(ticket: PendingTicketState) {
  const lines = [
    redactSensitiveText(ticket.description || ticket.summary || 'IT-Support-Fall'),
    '',
    ticket.affectedSystem ? `Betroffenes System: ${redactSensitiveText(ticket.affectedSystem)}` : '',
    ticket.impact ? `Auswirkung: ${ticket.impact}` : '',
    ticket.device ? `Gerät: ${redactSensitiveText(ticket.device)}` : '',
    ticket.operatingSystem ? `Betriebssystem: ${redactSensitiveText(ticket.operatingSystem)}` : '',
    ticket.errorMessage ? `Fehlermeldung: ${redactSensitiveText(ticket.errorMessage)}` : '',
    ticket.alreadyTried ? `Bereits versucht: ${redactSensitiveText(ticket.alreadyTried)}` : '',
  ].filter(Boolean);

  return truncateText(lines.join('\n'), 4000);
}

function hasTerminalStateSmalltalk(text: string) {
  return /^(ja|jap|ok|okay|danke|dankeschön|dankeschoen|alles klar|passt|gut|super|top)[.!?\s]*$/i.test(
    normalizeText(text),
  );
}

export function redactSensitiveText(value: string) {
  return value
    .replace(/\b(passwort|password|kennwort)\s*(?:ist|lautet|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(mfa|2fa|tan|pin)(?:\s*code)?\s*(?:ist|lautet|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(bearer\s+token)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/g, 'Bearer [redacted]')
    .replace(/\b(client_secret|access_token|refresh_token)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(api[-_\s]?key)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]')
    .replace(/\b(token|secret)\s*(?:ist|lautet|=|:)?\s*\S+/gi, '$1 [redacted]');
}

export function deepRedactSensitiveValues(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => deepRedactSensitiveValues(entry));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
      if (isSensitiveKey(key)) {
        return [key, entry ? '[redacted]' : entry];
      }
      return [key, deepRedactSensitiveValues(entry)];
    }),
  );
}

function isSensitiveKey(key: string) {
  return /pass(word|wort)|kennwort|mfa|2fa|tan|pin|api[-_\s]?key|bearer|token|secret|client_secret|access_token|refresh_token/i.test(
    key,
  );
}

function truncateText(value: string, maxLength: number) {
  const clean = value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trim()}…` : clean;
}

function dropEmpty(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
      return value !== undefined && value !== null && value !== '';
    }),
  );
}
