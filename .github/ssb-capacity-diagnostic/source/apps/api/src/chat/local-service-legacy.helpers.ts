import type { LocalServiceIntakeFlowConfig } from '../site-modules/module-configs';

export type LocalServiceContactDetails = {
  name?: string;
  email?: string;
  phone?: string;
  concern?: string;
  location?: string;
  urgency?: string;
  preferredContact?: 'email' | 'phone';
};

export function getMissingLocalServiceContactFields(contact: LocalServiceContactDetails) {
  const missingByField: Record<string, boolean> = {
    problem: !contact.concern,
    concern: !contact.concern,
    location: !hasCompleteLocalServiceAddress(contact.location),
    fullAddress: !hasCompleteLocalServiceAddress(contact.location),
    address: !hasCompleteLocalServiceAddress(contact.location),
    urgency: !contact.urgency,
    phone: !isValidLocalServicePhoneNumber(contact.phone),
    contact: !isValidLocalServicePhoneNumber(contact.phone),
    name: !hasLocalServiceFullName(contact.name),
    fullName: !hasLocalServiceFullName(contact.name),
  };
  const order = ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'];
  return order
    .filter((field) => missingByField[field])
    .map(normalizeLocalServiceMissingField)
    .filter((field, index, fields) => fields.indexOf(field) === index);
}

export function normalizeLocalServiceMissingField(field: string) {
  return field === 'problem' || field === 'concern'
    ? 'concern'
    : field === 'phone'
      ? 'contact'
      : field === 'fullAddress' || field === 'address'
        ? 'location'
        : field === 'fullName'
          ? 'name'
          : field;
}

export function getLocalServiceFieldLabel(field: string) {
  return field === 'concern'
    ? 'Problem oder Anliegen'
    : field === 'urgency'
      ? 'Dringlichkeit'
      : field === 'location'
        ? 'vollständige Einsatzadresse'
        : field === 'name'
          ? 'Vor- und Nachname'
          : field === 'contact'
            ? 'Telefonnummer'
            : field;
}

export function buildLocalServiceMissingNotice(missing: string[]) {
  const current = missing[0];
  const labels = [getLocalServiceFieldLabel(current)].filter(Boolean);

  if (labels.length === 0) {
    return '';
  }

  return `Für die Anfrage ${labels.length === 1 ? 'fehlt' : 'fehlen'} noch: ${formatGermanList(labels)}.`;
}

export function buildLocalServiceMissingFieldsQuestion(params: {
  missing: string[];
  scheduleIntent: boolean;
  preferredContact?: LocalServiceContactDetails['preferredContact'];
  intakeFlow?: LocalServiceIntakeFlowConfig;
  hasKnownUrgency?: boolean;
  contact?: LocalServiceContactDetails;
  lastMessage?: string;
}) {
  const questionTexts = params.intakeFlow?.questionTexts || {};
  const missingNotice = buildLocalServiceMissingNotice(params.missing);
  if (params.missing[0] === 'concern') {
    const question = params.scheduleIntent
      ? params.hasKnownUrgency
        ? questionTexts.problem || 'Was genau ist betroffen?'
        : questionTexts.callback || 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?'
      : questionTexts.problem || 'Was genau ist betroffen?';
    return [missingNotice, question].filter(Boolean).join(' ');
  }
  if (params.missing[0] === 'location') {
    return buildLocalServiceAddressQuestion(
      params.lastMessage,
      missingNotice,
      questionTexts.fullAddress || questionTexts.location,
    );
  }
  if (params.missing[0] === 'urgency') {
    const question = questionTexts.urgency || 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?';
    return [missingNotice, question].filter(Boolean).join(' ');
  }
  if (params.missing[0] === 'name' || params.missing.includes('name')) {
    return buildLocalServiceNameQuestion(
      params.lastMessage,
      params.contact,
      missingNotice,
      questionTexts.fullName || questionTexts.name,
    );
  }
  if (params.missing[0] === 'contact' || params.missing.includes('contact')) {
    if (params.preferredContact === 'email') {
      return [missingNotice, 'Über welche E-Mail-Adresse können wir Sie erreichen?'].filter(Boolean).join(' ');
    }
    return buildLocalServicePhoneQuestion(params.lastMessage, missingNotice, questionTexts.phone);
  }

  return '';
}

export function hasCompleteLocalServiceAddress(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  const hasZip = /\b\d{5}\b/.test(normalized);
  const hasHouseNumber = /\b\d{1,5}\s?[a-zA-Z]?\b/.test(normalized);
  const hasStreetWord =
    /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]*(?:straße|strasse|str\.|weg|gasse|allee|ring|platz|damm|ufer|chaussee|pfad|steig|berg|tal|markt)\b|[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+\s+(?:Straße|Strasse|Weg|Gasse|Allee|Ring|Platz|Damm|Ufer|Chaussee|Pfad|Steig|Berg|Tal|Markt)\b)/i.test(
      normalized,
    );
  const afterZip = normalized.match(/\b\d{5}\b\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})/)?.[1];
  const beforeZip = normalized.match(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})\s+\b\d{5}\b/)?.[1];
  const city = afterZip || beforeZip;

  return Boolean(hasZip && hasHouseNumber && hasStreetWord && city);
}

export function hasPartialLocalServiceAddress(value: string) {
  return Boolean(
    /\b\d{5}\b/.test(value) ||
      /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]*(?:straße|strasse|str\.|weg|gasse|allee|ring|platz|damm|ufer|chaussee|pfad|steig|berg|tal|markt)\b\s+\d{1,5}\s?[a-zA-Z]?\b/i.test(value) ||
      /\b(?:in|aus|bei|wohne in|bin in)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+/i.test(value) ||
      /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2}$/.test(value.trim()),
  );
}

export function isValidLocalServicePhoneNumber(value: string | undefined) {
  if (!value) {
    return false;
  }
  const compact = value.trim();
  if (!/^(\+|0)/.test(compact)) {
    return false;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 18;
}

export function hasLocalServiceFullName(value: string | undefined) {
  if (!value) {
    return false;
  }
  const words = cleanLocalServiceExtractedText(value)
    .split(/\s+/)
    .filter(isLocalServiceNameToken);
  return words.length >= 2;
}

export function cleanLocalServiceExtractedText(value: string) {
  return value
    .replace(/\b(e-mail|email|telefon|handy|nummer|und|meine|mein)\b.*$/i, '')
    .replace(/[,.].*$/, '')
    .trim();
}

function buildLocalServiceAddressQuestion(
  lastMessage: string | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = (lastMessage || '').trim();
  const fallback = configuredQuestion ||
    'Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.';

  if (/\b\d{5}\b/.test(text) && !hasCompleteLocalServiceAddress(text)) {
    return 'Die PLZ allein reicht noch nicht. Bitte nennen Sie noch Straße, Hausnummer und Ort der Einsatzadresse.';
  }

  if (hasPartialLocalServiceAddress(text) && !hasCompleteLocalServiceAddress(text)) {
    return 'Die Einsatzadresse ist noch unvollständig. Bitte nennen Sie Straße, Hausnummer, PLZ und Ort.';
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function buildLocalServiceNameQuestion(
  lastMessage: string | undefined,
  contact: LocalServiceContactDetails | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = cleanLocalServiceExtractedText((lastMessage || '').trim());
  const words = text.split(/\s+/).filter(isLocalServiceNameToken);
  const fallback = configuredQuestion || 'Bitte nennen Sie uns noch Ihren Vor- und Nachnamen.';

  if (!hasLocalServiceFullName(contact?.name) && words.length === 1) {
    return [missingNotice, 'Ein einzelner Name reicht noch nicht. Bitte nennen Sie uns Ihren Vor- und Nachnamen.']
      .filter(Boolean)
      .join(' ');
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function buildLocalServicePhoneQuestion(
  lastMessage: string | undefined,
  missingNotice: string,
  configuredQuestion?: string,
) {
  const text = (lastMessage || '').trim();
  const hasDigits = /\d/.test(text);
  const fallback = configuredQuestion || 'Unter welcher Telefonnummer können wir Sie für den Rückruf erreichen?';

  if (hasDigits && !extractLocalServicePhoneNumber(text)) {
    return 'Die Telefonnummer wirkt unvollständig oder ist keine gültige Rückrufnummer. Unter welcher Telefonnummer kann der Notdienst Sie zurückrufen?';
  }

  return [missingNotice, fallback].filter(Boolean).join(' ');
}

function extractLocalServicePhoneNumber(message: string) {
  const candidate = message.match(/(?:\+?\d[\d\s()./-]{4,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
  if (!candidate) {
    return undefined;
  }
  return isValidLocalServicePhoneNumber(candidate) ? candidate : undefined;
}

function formatGermanList(values: string[]) {
  if (values.length <= 1) {
    return values[0] || '';
  }

  if (values.length === 2) {
    return `${values[0]} und ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')} und ${values[values.length - 1]}`;
}

function isLocalServiceNameToken(value: string) {
  return /^[\p{L}][\p{L}'-]{1,}$/u.test(value);
}
