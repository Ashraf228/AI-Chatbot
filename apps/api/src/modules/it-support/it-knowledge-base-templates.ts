export type ItKnowledgeTemplateCategory =
  | 'access'
  | 'connectivity'
  | 'email'
  | 'hardware'
  | 'software'
  | 'security'
  | 'account'
  | 'general';

export type ItKnowledgeTemplate = {
  key: string;
  title: string;
  category: ItKnowledgeTemplateCategory;
  issueType:
    | 'password'
    | 'mfa'
    | 'vpn'
    | 'network'
    | 'email'
    | 'outlook'
    | 'printer'
    | 'access'
    | 'hardware'
    | 'software'
    | 'security'
    | 'server'
    | 'generic_it';
  affectedSystem?: string;
  tags: string[];
  symptoms: string[];
  safeSteps: string[];
  doNotDo: string[];
  escalateWhen: string[];
  requiredTicketFields: string[];
  customerFacingContent: string;
};

const DEFAULT_TICKET_FIELDS = ['description', 'affectedSystem', 'impact', 'reporterEmail'];
const CONTACT_TICKET_FIELDS = [...DEFAULT_TICKET_FIELDS, 'reporterName'];
const DEVICE_TICKET_FIELDS = [...DEFAULT_TICKET_FIELDS, 'device', 'operatingSystem'];

function article(input: {
  title: string;
  symptoms: string[];
  safeSteps: string[];
  doNotDo: string[];
  escalateWhen: string[];
  requiredTicketFields: string[];
}) {
  return [
    `# ${input.title}`,
    '',
    '## Woran du das Problem erkennst',
    ...input.symptoms.map((entry) => `- ${entry}`),
    '',
    '## Sichere erste Schritte',
    ...input.safeSteps.map((entry, index) => `${index + 1}. ${entry}`),
    '',
    '## Bitte nicht tun',
    ...input.doNotDo.map((entry) => `- ${entry}`),
    '',
    '## Wann ein Ticket sinnvoll ist',
    ...input.escalateWhen.map((entry) => `- ${entry}`),
    '',
    '## Hilfreiche Angaben fuer ein Ticket',
    ...input.requiredTicketFields.map((entry) => `- ${entry}`),
  ].join('\n');
}

function template(input: Omit<ItKnowledgeTemplate, 'customerFacingContent'>): ItKnowledgeTemplate {
  return {
    ...input,
    customerFacingContent: article(input),
  };
}

export const IT_KNOWLEDGE_BASE_TEMPLATES: ItKnowledgeTemplate[] = [
  template({
    key: 'vpn-not-connecting',
    title: 'VPN verbindet nicht',
    category: 'connectivity',
    issueType: 'vpn',
    affectedSystem: 'VPN',
    tags: ['vpn', 'remote-work', 'netzwerk'],
    symptoms: [
      'Die VPN-Verbindung startet nicht oder bricht direkt wieder ab.',
      'Interne Systeme sind ausserhalb des Firmennetzwerks nicht erreichbar.',
      'Es erscheint eine Fehlermeldung im VPN-Client.',
    ],
    safeSteps: [
      'Pruefen Sie, ob die Internetverbindung ohne VPN funktioniert.',
      'Starten Sie den VPN-Client einmal neu und melden Sie sich erneut an.',
      'Pruefen Sie Datum und Uhrzeit am Geraet, da falsche Zeiten Anmeldungen stoeren koennen.',
      'Notieren Sie eine sichtbare Fehlermeldung ohne sensible Zugangsdaten.',
    ],
    doNotDo: [
      'Geben Sie keine Passwoerter, MFA-Codes oder Wiederherstellungscodes weiter.',
      'Installieren Sie keine unbekannten VPN-Profile aus E-Mails oder Chats.',
      'Aendern Sie keine Sicherheits- oder Firewall-Einstellungen ohne IT-Freigabe.',
    ],
    escalateWhen: [
      'Die VPN-Verbindung nach den sicheren Schritten weiter nicht funktioniert.',
      'Mehrere Personen betroffen sind.',
      'Eine Sicherheitswarnung oder ein Zertifikatsfehler angezeigt wird.',
    ],
    requiredTicketFields: DEVICE_TICKET_FIELDS,
  }),
  template({
    key: 'password-reset',
    title: 'Passwort zuruecksetzen',
    category: 'account',
    issueType: 'password',
    affectedSystem: 'Benutzerkonto',
    tags: ['passwort', 'login', 'konto'],
    symptoms: [
      'Die Anmeldung wird abgelehnt.',
      'Das Passwort wurde vergessen oder funktioniert nicht mehr.',
      'Nach mehreren Versuchen ist keine Anmeldung moeglich.',
    ],
    safeSteps: [
      'Nutzen Sie den offiziell bereitgestellten Passwort-Zuruecksetzen-Link des Unternehmens, falls vorhanden.',
      'Pruefen Sie, ob die Feststelltaste aktiv ist und das richtige Konto verwendet wird.',
      'Melden Sie ein gesperrtes Konto an den IT-Support, statt weitere Anmeldeversuche zu erzwingen.',
    ],
    doNotDo: [
      'Teilen Sie Ihr Passwort niemandem mit.',
      'Senden Sie keine Screenshots mit sichtbaren Zugangsdaten.',
      'Nutzen Sie keine privaten Passwortlisten oder fremde Konten.',
    ],
    escalateWhen: [
      'Das Konto gesperrt ist.',
      'Der Self-Service nicht funktioniert.',
      'Sie vermuten, dass jemand anderes Zugriff auf Ihr Konto hatte.',
    ],
    requiredTicketFields: CONTACT_TICKET_FIELDS,
  }),
  template({
    key: 'mfa-2fa-problem',
    title: 'MFA / 2FA funktioniert nicht',
    category: 'access',
    issueType: 'mfa',
    affectedSystem: 'MFA/2FA',
    tags: ['mfa', '2fa', 'authenticator', 'login'],
    symptoms: [
      'Der Authenticator-Code wird nicht akzeptiert.',
      'Die Push-Bestaetigung kommt nicht an.',
      'Ein neues Smartphone ist noch nicht eingerichtet.',
    ],
    safeSteps: [
      'Pruefen Sie die Uhrzeit am Smartphone und am Computer.',
      'Oeffnen Sie die Authenticator-App manuell und versuchen Sie die Anmeldung erneut.',
      'Pruefen Sie, ob das Geraet Internetempfang hat.',
    ],
    doNotDo: [
      'Geben Sie keine MFA-Codes, TANs oder Wiederherstellungscodes weiter.',
      'Bestaetigen Sie keine Push-Anfrage, die Sie nicht selbst ausgeloest haben.',
      'Entfernen Sie keine Sicherheitsmethode ohne IT-Freigabe.',
    ],
    escalateWhen: [
      'Sie ein neues oder verlorenes Smartphone haben.',
      'Unbekannte MFA-Anfragen erscheinen.',
      'Der Login trotz korrekter Schritte blockiert bleibt.',
    ],
    requiredTicketFields: [...CONTACT_TICKET_FIELDS, 'device'],
  }),
  template({
    key: 'outlook-email-not-sending',
    title: 'Outlook sendet oder empfaengt keine E-Mails',
    category: 'email',
    issueType: 'outlook',
    affectedSystem: 'Outlook/E-Mail',
    tags: ['outlook', 'email', 'postfach'],
    symptoms: [
      'E-Mails bleiben im Postausgang.',
      'Neue E-Mails werden nicht angezeigt.',
      'Outlook meldet Verbindungs- oder Synchronisationsprobleme.',
    ],
    safeSteps: [
      'Pruefen Sie, ob die Internetverbindung funktioniert.',
      'Starten Sie Outlook neu und warten Sie kurz auf die Synchronisation.',
      'Pruefen Sie, ob Outlook im Offline-Modus ist.',
      'Notieren Sie eine sichtbare Fehlermeldung ohne sensible Inhalte.',
    ],
    doNotDo: [
      'Leiten Sie keine vertraulichen E-Mails an private Adressen weiter.',
      'Loeschen Sie keine Postfachdaten zur Fehlerbehebung.',
      'Geben Sie keine Zugangsdaten weiter.',
    ],
    escalateWhen: [
      'Das Problem laenger als einige Minuten besteht.',
      'Mehrere Postfaecher betroffen sind.',
      'Wichtige E-Mails fuer den Betrieb blockiert sind.',
    ],
    requiredTicketFields: [...DEFAULT_TICKET_FIELDS, 'errorMessage'],
  }),
  template({
    key: 'wifi-network-issue',
    title: 'WLAN oder Netzwerk funktioniert nicht',
    category: 'connectivity',
    issueType: 'network',
    affectedSystem: 'WLAN/Netzwerk',
    tags: ['wlan', 'netzwerk', 'internet'],
    symptoms: [
      'Keine Verbindung zum WLAN oder LAN.',
      'Internetseiten laden nicht oder sehr langsam.',
      'Interne Systeme sind nicht erreichbar.',
    ],
    safeSteps: [
      'Pruefen Sie, ob andere Webseiten oder Dienste erreichbar sind.',
      'Verbinden Sie sich erneut mit dem bekannten Unternehmensnetzwerk.',
      'Starten Sie das betroffene Geraet neu, wenn es gefahrlos moeglich ist.',
      'Pruefen Sie, ob mehrere Personen im gleichen Bereich betroffen sind.',
    ],
    doNotDo: [
      'Verbinden Sie sich nicht mit unbekannten offenen Netzwerken fuer Unternehmensarbeit.',
      'Aendern Sie keine Router-, Switch- oder Firewall-Konfiguration.',
      'Teilen Sie keine WLAN-Schluessel in Chats.',
    ],
    escalateWhen: [
      'Mehrere Nutzer oder ein ganzer Standort betroffen sind.',
      'Produktions- oder Kundensysteme nicht erreichbar sind.',
      'Das Problem nach den sicheren Schritten weiter besteht.',
    ],
    requiredTicketFields: [...DEVICE_TICKET_FIELDS, 'location'],
  }),
  template({
    key: 'printer-not-printing',
    title: 'Drucker druckt nicht',
    category: 'hardware',
    issueType: 'printer',
    affectedSystem: 'Drucker',
    tags: ['drucker', 'hardware', 'papier'],
    symptoms: [
      'Druckauftraege bleiben in der Warteschlange.',
      'Der Drucker ist offline oder nicht erreichbar.',
      'Papier- oder Tonerhinweise werden angezeigt.',
    ],
    safeSteps: [
      'Pruefen Sie Papier, Toner und sichtbare Meldungen am Drucker.',
      'Pruefen Sie, ob der richtige Drucker ausgewaehlt ist.',
      'Brechen Sie nur den eigenen Druckauftrag ab, wenn er haengt.',
      'Starten Sie den Drucker nur neu, wenn dadurch keine laufenden Arbeiten gestoert werden.',
    ],
    doNotDo: [
      'Oeffnen Sie keine gesperrten Wartungsklappen ohne Einweisung.',
      'Installieren Sie keine unbekannten Druckertreiber aus dem Internet.',
      'Aendern Sie keine Netzwerkadresse des Druckers.',
    ],
    escalateWhen: [
      'Der Drucker fuer mehrere Personen nicht funktioniert.',
      'Fehlercodes oder Hardwaremeldungen erscheinen.',
      'Ein wichtiger Druckprozess blockiert ist.',
    ],
    requiredTicketFields: [...DEFAULT_TICKET_FIELDS, 'location', 'errorMessage'],
  }),
  template({
    key: 'laptop-slow',
    title: 'Laptop oder PC ist langsam',
    category: 'hardware',
    issueType: 'hardware',
    affectedSystem: 'Laptop/PC',
    tags: ['laptop', 'pc', 'performance'],
    symptoms: [
      'Programme starten sehr langsam.',
      'Das Geraet reagiert verzoegert.',
      'Luefter laufen dauerhaft oder das Geraet wird ungewoehnlich warm.',
    ],
    safeSteps: [
      'Starten Sie das Geraet neu, wenn keine wichtigen Arbeiten offen sind.',
      'Schliessen Sie nicht benoetigte Programme.',
      'Pruefen Sie, ob viele Updates oder Synchronisationen laufen.',
      'Notieren Sie, seit wann das Problem besteht.',
    ],
    doNotDo: [
      'Loeschen Sie keine Systemdateien.',
      'Installieren Sie keine Tuning- oder Cleaning-Tools.',
      'Deaktivieren Sie keine Schutzsoftware.',
    ],
    escalateWhen: [
      'Das Geraet nicht arbeitsfaehig ist.',
      'Das Problem nach Neustart weiter besteht.',
      'Verdacht auf Malware, Datenverlust oder Hardwaredefekt besteht.',
    ],
    requiredTicketFields: DEVICE_TICKET_FIELDS,
  }),
  template({
    key: 'software-not-working',
    title: 'Software funktioniert nicht',
    category: 'software',
    issueType: 'software',
    affectedSystem: 'Software/Anwendung',
    tags: ['software', 'programm', 'app'],
    symptoms: [
      'Eine Anwendung startet nicht oder stuerzt ab.',
      'Funktionen reagieren nicht wie erwartet.',
      'Eine Fehlermeldung wird angezeigt.',
    ],
    safeSteps: [
      'Starten Sie die Anwendung neu.',
      'Pruefen Sie, ob andere Nutzer das gleiche Problem haben.',
      'Notieren Sie den Namen der Anwendung und eine sichtbare Fehlermeldung.',
      'Starten Sie das Geraet neu, wenn es gefahrlos moeglich ist.',
    ],
    doNotDo: [
      'Installieren Sie keine inoffiziellen Versionen oder Patches.',
      'Aendern Sie keine Lizenz- oder Systemdateien.',
      'Geben Sie keine Zugangsdaten in unbekannte Hilfsprogramme ein.',
    ],
    escalateWhen: [
      'Die Anwendung fuer die Arbeit noetig ist und weiter ausfaellt.',
      'Mehrere Personen betroffen sind.',
      'Daten fehlen oder eine Fehlermeldung dauerhaft erscheint.',
    ],
    requiredTicketFields: [...DEVICE_TICKET_FIELDS, 'errorMessage'],
  }),
  template({
    key: 'access-permission-request',
    title: 'Zugriff oder Berechtigung beantragen',
    category: 'access',
    issueType: 'access',
    affectedSystem: 'Zugriff/Berechtigung',
    tags: ['zugriff', 'berechtigung', 'freigabe'],
    symptoms: [
      'Ein Ordner, System oder Programm ist nicht erreichbar.',
      'Eine Meldung zeigt fehlende Berechtigungen.',
      'Ein neuer Aufgabenbereich erfordert Zugriff.',
    ],
    safeSteps: [
      'Pruefen Sie, ob Sie mit dem richtigen Konto angemeldet sind.',
      'Klaeren Sie intern, welcher Zugriff genau benoetigt wird.',
      'Notieren Sie System, Ordner oder Anwendung und den geschaeftlichen Grund.',
    ],
    doNotDo: [
      'Nutzen Sie kein Konto einer anderen Person.',
      'Teilen Sie keine Zugangsdaten.',
      'Umgehen Sie keine Freigabeprozesse.',
    ],
    escalateWhen: [
      'Der Zugriff fuer eine konkrete Aufgabe benoetigt wird.',
      'Eine Freigabe durch Fuehrungskraft oder Fachbereich erforderlich ist.',
      'Ein Fehler statt einer normalen Berechtigungsfrage vorliegt.',
    ],
    requiredTicketFields: [...CONTACT_TICKET_FIELDS, 'department'],
  }),
  template({
    key: 'phishing-mail-received',
    title: 'Phishing-Mail erhalten',
    category: 'security',
    issueType: 'security',
    affectedSystem: 'E-Mail/IT-Sicherheit',
    tags: ['phishing', 'security', 'email'],
    symptoms: [
      'Eine E-Mail fordert zu ungewoehnlichen Handlungen auf.',
      'Links, Anhaenge oder Absender wirken verdaechtig.',
      'Es wird Druck aufgebaut oder mit Sperrung gedroht.',
    ],
    safeSteps: [
      'Oeffnen Sie keine Links oder Anhaenge aus der verdaechtigen Nachricht.',
      'Antworten Sie nicht auf die Nachricht.',
      'Melden Sie die Nachricht sofort an den IT-Support oder ueber den vorgesehenen Meldeweg.',
    ],
    doNotDo: [
      'Keine Links oder Anhaenge oeffnen.',
      'Keine sensiblen Daten eingeben.',
      'Keine Nachricht an private Adressen weiterleiten.',
    ],
    escalateWhen: [
      'Sie auf einen Link geklickt oder Daten eingegeben haben.',
      'Mehrere Personen die Nachricht erhalten haben.',
      'Die Nachricht eine Zahlung, Passwortaenderung oder dringende Freigabe fordert.',
    ],
    requiredTicketFields: [...DEFAULT_TICKET_FIELDS, 'reporterName'],
  }),
  template({
    key: 'malware-suspicion',
    title: 'Malware- oder Virenverdacht',
    category: 'security',
    issueType: 'security',
    affectedSystem: 'Geraet/IT-Sicherheit',
    tags: ['malware', 'virus', 'security'],
    symptoms: [
      'Unbekannte Programme, Warnungen oder Pop-ups erscheinen.',
      'Das Geraet verhaelt sich ungewoehnlich.',
      'Dateien fehlen oder lassen sich nicht oeffnen.',
    ],
    safeSteps: [
      'Trennen Sie das Geraet vom Netzwerk, wenn ein akuter Verdacht besteht.',
      'Nutzen Sie das Geraet nicht weiter fuer vertrauliche Arbeiten.',
      'Informieren Sie sofort den IT-Support und nennen Sie Geraet und Zeitpunkt.',
    ],
    doNotDo: [
      'Keine unbekannten Links oder Anhaenge oeffnen.',
      'Keine sensiblen Daten eingeben.',
      'Keine Schutzsoftware deaktivieren.',
    ],
    escalateWhen: [
      'Immer, wenn Malware oder Virenverdacht besteht.',
      'Wenn mehrere Geraete betroffen sein koennten.',
      'Wenn Datenverlust oder Verschluesselung sichtbar ist.',
    ],
    requiredTicketFields: DEVICE_TICKET_FIELDS,
  }),
  template({
    key: 'account-locked',
    title: 'Konto gesperrt oder Login blockiert',
    category: 'account',
    issueType: 'password',
    affectedSystem: 'Benutzerkonto/Login',
    tags: ['konto', 'login', 'gesperrt'],
    symptoms: [
      'Die Anmeldung meldet ein gesperrtes Konto.',
      'Zu viele Anmeldeversuche wurden erkannt.',
      'Login ist trotz korrekter Daten nicht moeglich.',
    ],
    safeSteps: [
      'Warten Sie kurz und versuchen Sie nicht mehrfach hintereinander neue Logins.',
      'Pruefen Sie, ob das richtige Konto und die richtige Tastaturbelegung genutzt werden.',
      'Melden Sie die Sperrung an den IT-Support.',
    ],
    doNotDo: [
      'Geben Sie keine Passwoerter weiter.',
      'Nutzen Sie kein fremdes Konto als Umgehung.',
      'Bestaetigen Sie keine unbekannten Login- oder MFA-Anfragen.',
    ],
    escalateWhen: [
      'Das Konto weiter gesperrt bleibt.',
      'Sie unbekannte Login- oder MFA-Anfragen sehen.',
      'Der Zugang fuer dringende Arbeit benoetigt wird.',
    ],
    requiredTicketFields: CONTACT_TICKET_FIELDS,
  }),
  template({
    key: 'device-lost',
    title: 'Geraet verloren oder gestohlen',
    category: 'security',
    issueType: 'security',
    affectedSystem: 'Endgeraet',
    tags: ['geraet', 'verlust', 'diebstahl', 'security'],
    symptoms: [
      'Laptop, Smartphone, Tablet oder Token ist nicht mehr auffindbar.',
      'Ein Unternehmensgeraet wurde gestohlen.',
      'Es besteht Risiko fuer Zugriff auf Unternehmensdaten.',
    ],
    safeSteps: [
      'Melden Sie den Verlust sofort an IT oder die interne Kontaktstelle.',
      'Nennen Sie Geraetetyp, ungefaehren Zeitpunkt und letzten bekannten Ort.',
      'Melden Sie, ob das Geraet entsperrt oder angemeldet war.',
    ],
    doNotDo: [
      'Keine sensiblen Daten ueber unsichere Kanaele teilen.',
      'Keine unbekannten Finder kontaktieren, wenn Sicherheit unklar ist.',
      'Keine privaten Ersatzgeraete ohne Freigabe fuer Unternehmensdaten nutzen.',
    ],
    escalateWhen: [
      'Immer bei Verlust oder Diebstahl eines Unternehmensgeraets.',
      'Wenn Kundendaten oder interne Daten betroffen sein koennten.',
      'Wenn das Geraet nicht gesperrt war.',
    ],
    requiredTicketFields: [...CONTACT_TICKET_FIELDS, 'device', 'location'],
  }),
  template({
    key: 'server-or-company-outage',
    title: 'Server-, Netzwerk- oder Unternehmensausfall',
    category: 'general',
    issueType: 'server',
    affectedSystem: 'Server/Netzwerk',
    tags: ['server', 'ausfall', 'netzwerk', 'kritisch'],
    symptoms: [
      'Zentrale Systeme sind fuer viele Personen nicht erreichbar.',
      'Ein Standort oder die gesamte Firma kann nicht arbeiten.',
      'Mehrere Dienste fallen gleichzeitig aus.',
    ],
    safeSteps: [
      'Pruefen Sie kurz, ob mehrere Personen betroffen sind.',
      'Melden Sie den Ausfall sofort als kritischen Vorfall an den IT-Support.',
      'Sammeln Sie betroffene Systeme, Standort und Startzeit des Problems.',
    ],
    doNotDo: [
      'Keine sensiblen Daten eingeben.',
      'Keine Links oder Anhaenge aus unbekannten Fehlermeldungen oeffnen.',
      'Keine Infrastruktur selbst neu konfigurieren.',
    ],
    escalateWhen: [
      'Immer bei Server-, Netzwerk- oder Unternehmensausfall.',
      'Wenn mehrere Nutzer, Abteilungen oder Standorte betroffen sind.',
      'Wenn Kunden- oder Produktionsprozesse stillstehen.',
    ],
    requiredTicketFields: [...DEFAULT_TICKET_FIELDS, 'affectedUsers', 'location'],
  }),
  template({
    key: 'generic-it-ticket',
    title: 'Allgemeines IT-Problem melden',
    category: 'general',
    issueType: 'generic_it',
    affectedSystem: 'IT',
    tags: ['it', 'support', 'ticket'],
    symptoms: [
      'Ein IT-Problem passt nicht eindeutig in eine Kategorie.',
      'Ein System, Geraet oder Zugriff funktioniert nicht wie erwartet.',
      'Sie benoetigen Unterstuetzung durch den IT-Support.',
    ],
    safeSteps: [
      'Beschreiben Sie kurz, was nicht funktioniert.',
      'Notieren Sie betroffenes System, Geraet und Zeitpunkt.',
      'Pruefen Sie, ob weitere Personen betroffen sind.',
    ],
    doNotDo: [
      'Geben Sie keine Passwoerter, MFA-Codes oder Zugangsdaten weiter.',
      'Installieren Sie keine unbekannten Hilfsprogramme.',
      'Fuehren Sie keine riskanten Systemaenderungen ohne IT-Freigabe durch.',
    ],
    escalateWhen: [
      'Das Problem die Arbeit blockiert.',
      'Sicherheits- oder Datenrisiken bestehen.',
      'Die Ursache unklar bleibt.',
    ],
    requiredTicketFields: DEFAULT_TICKET_FIELDS,
  }),
];

export function listItKnowledgeBaseTemplates(): ItKnowledgeTemplate[] {
  return IT_KNOWLEDGE_BASE_TEMPLATES.map((templateEntry) => ({
    ...templateEntry,
    tags: [...templateEntry.tags],
    symptoms: [...templateEntry.symptoms],
    safeSteps: [...templateEntry.safeSteps],
    doNotDo: [...templateEntry.doNotDo],
    escalateWhen: [...templateEntry.escalateWhen],
    requiredTicketFields: [...templateEntry.requiredTicketFields],
  }));
}

export function getItKnowledgeBaseTemplate(key: string): ItKnowledgeTemplate | null {
  const normalizedKey = key.trim().toLowerCase();
  const found = IT_KNOWLEDGE_BASE_TEMPLATES.find((templateEntry) => templateEntry.key === normalizedKey);
  return found ? listItKnowledgeBaseTemplates().find((templateEntry) => templateEntry.key === found.key) || null : null;
}

export function renderItKnowledgeTemplateAsKnowledgeDocument(templateEntry: ItKnowledgeTemplate): string {
  return article(templateEntry);
}
