import type { LocalServiceIntakeFlowConfig } from '../site-modules/module-configs';
import {
  cleanLocalServiceExtractedText,
  getMissingLocalServiceContactFields,
  hasCompleteLocalServiceAddress,
  hasLocalServiceFullName,
  hasPartialLocalServiceAddress,
  isValidLocalServicePhoneNumber,
} from './local-service-legacy.helpers';

export type ContactDetails = {
  name?: string;
  email?: string;
  phone?: string;
  concern?: string;
  location?: string;
  urgency?: string;
  preferredContact?: 'email' | 'phone';
};

export type PendingLeadState = ContactDetails & {
  status?: 'pending' | 'completed' | 'paused';
  intent?: 'lead' | 'schedule';
  scheduleIntent?: boolean;
  leadPromptCount?: number;
  lastLeadPromptAt?: string;
  leadCapturePaused?: boolean;
  pausedAt?: string;
  pauseReason?: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  completedLeadId?: string;
};

export type ConversationState = {
  intent?: 'lead' | 'support' | 'sales' | 'appointment' | 'product_advice' | 'ticket' | null;
  stage?: 'discovery' | 'qualification' | 'contact_collection' | 'scheduling' | 'completed';
  topic?: string | null;
  urgency?: string | null;
  goal?: 'capture_lead' | 'schedule_call' | 'answer_question' | 'create_ticket' | 'recommend_product' | null;
  collectedFields?: ContactDetails & {
    company?: string;
  };
  missingFields?: string[];
  nextExpectedField?: string | null;
  lastUserIntent?: string | null;
  updatedAt?: string;
};

export function extractContactDetails(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
): ContactDetails {
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const location = extractServiceLocation(message, pendingLead, intakeFlow);
  const addressIsStillMissing = pendingLead?.status === 'pending' && !pendingLead.location;
  const messageIsAddressOnly = Boolean(intakeFlow && (location || (addressIsStillMissing && hasPartialServiceAddress(message))));
  const phone = extractPhoneNumber(message);
  const name = messageIsAddressOnly
    ? undefined
    : extractName(message) || inferNameFromPendingAnswer(message, pendingLead, intakeFlow);
  const urgency = extractServiceUrgency(message, intakeFlow);
  const concern = extractConcern(message, pendingLead, intakeFlow);
  const preferredContact = extractPreferredContact(message);

  return {
    name,
    email,
    phone,
    concern,
    location,
    urgency,
    preferredContact,
  };
}

export function extractPhoneNumber(message: string) {
  const candidate = message.match(/(?:\+?\d[\d\s()./-]{4,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim();
  if (!candidate) {
    return undefined;
  }
  return isValidPhoneNumber(candidate) ? candidate : undefined;
}

export function extractPreferredContact(message: string): ContactDetails['preferredContact'] | undefined {
  if (/\b(telefon|telefonisch|phone|handy|anruf|anrufen|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|whatsapp)\b/i.test(message)) {
    return 'phone';
  }

  if (/\b(e-mail|email|mail|per mail)\b/i.test(message)) {
    return 'email';
  }

  return undefined;
}

export function extractName(text: string) {
  const patterns = [
    /\bmein name ist\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bich hei(?:ß|ss)e\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
    /\bname\s*:\s*([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1]?.trim();
    if (match) {
      return cleanExtractedText(match);
    }
  }

  return undefined;
}

export function inferNameFromPendingAnswer(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  if (pendingLead?.status !== 'pending' || hasFullName(pendingLead.name)) {
    return undefined;
  }

  const addressIsStillMissing = !pendingLead.location;
  if (intakeFlow && (extractFullServiceAddress(message) || (addressIsStillMissing && hasPartialServiceAddress(message)))) {
    return undefined;
  }

  if (
    (!pendingLead.location &&
      (extractServiceLocation(message, pendingLead, intakeFlow) || (Boolean(intakeFlow) && hasPartialServiceAddress(message)))) ||
    (!pendingLead.urgency && extractServiceUrgency(message, intakeFlow))
  ) {
    return undefined;
  }

  const clean = cleanExtractedText(message.trim());
  if (!clean || clean.length > 60 || clean.includes('@') || /\d/.test(clean) || hasLocalServiceSignal(clean, intakeFlow)) {
    return undefined;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 4) {
    return undefined;
  }

  const acceptsNameToken = Boolean(intakeFlow) ? isNameToken : isStrictNameToken;
  if (words.every(acceptsNameToken)) {
    return clean;
  }

  return undefined;
}

export function extractConcern(
  message: string,
  pendingLead: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  const value = message.trim();
  if (!value) {
    return undefined;
  }

  if (
    intakeFlow &&
    matchesKeyword(value, intakeFlow.problemKeywords) &&
    !isGenericUrgencyQuestion(value, intakeFlow)
  ) {
    return sanitizeConcern(value);
  }

  if (looksLikeContactOnly(value)) {
    return undefined;
  }

  const normalized = normalizeText(value);
  if (isGenericUrgencyQuestion(value, intakeFlow)) {
    return undefined;
  }

  if (hasScheduleIntent(normalized, intakeFlow) && (isGenericScheduleIntent(value) || hasCallbackOnlyIntent(value, intakeFlow))) {
    return undefined;
  }

  if (
    intakeFlow &&
    matchesKeyword(value, intakeFlow.genericLocalServiceKeywords) &&
    !matchesKeyword(value, intakeFlow.problemKeywords) &&
    !matchesKeyword(value, intakeFlow.pricingKeywords)
  ) {
    return undefined;
  }

  if (isGenericLocalServiceIntent(value, intakeFlow)) {
    return undefined;
  }

  if (pendingLead?.status === 'pending' && pendingLead.concern) {
    if (
      !pendingLead.location &&
      (extractServiceLocation(value, pendingLead, intakeFlow) || (Boolean(intakeFlow) && hasPartialServiceAddress(value)))
    ) {
      return undefined;
    }
    if (!pendingLead.urgency && extractServiceUrgency(value, intakeFlow)) {
      return undefined;
    }
  }

  if (pendingLead?.status === 'pending' && !pendingLead.concern && !inferNameFromPendingAnswer(value, pendingLead, intakeFlow)) {
    return sanitizeConcern(value);
  }

  if (
    (hasLeadIntent(normalized, intakeFlow) || hasScheduleIntent(normalized, intakeFlow)) &&
    !isGenericLeadIntent(value)
  ) {
    return sanitizeConcern(value);
  }

  return undefined;
}

export function sanitizeConcern(value: string) {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '')
    .replace(/\bmein name ist\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\bich hei(?:ß|ss)e\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,3}/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/[,;:\s]+$/g, '')
    .trim();
}

export function mergeContactDetails(
  pendingLead: PendingLeadState | null,
  current: ContactDetails,
): ContactDetails {
  return {
    name: current.name || pendingLead?.name,
    email: current.email || pendingLead?.email,
    phone: current.phone || pendingLead?.phone,
    concern: current.concern || pendingLead?.concern,
    location: current.location || pendingLead?.location,
    urgency: current.urgency || pendingLead?.urgency,
    preferredContact: current.preferredContact || pendingLead?.preferredContact,
  };
}

export function mergeContactDetailsFromState(contact: ContactDetails, state: ConversationState | null): ContactDetails {
  const collected = state?.collectedFields || {};
  return {
    name: contact.name || collected.name,
    email: contact.email || collected.email,
    phone: contact.phone || collected.phone,
    concern: contact.concern || collected.concern || state?.topic || undefined,
    location: contact.location || collected.location,
    urgency: contact.urgency || collected.urgency || state?.urgency || undefined,
    preferredContact: contact.preferredContact || collected.preferredContact,
  };
}

export function ensureScheduleContactContext(
  contact: ContactDetails,
  state: ConversationState | null,
  scheduleIntent: boolean,
): ContactDetails {
  if (!scheduleIntent || contact.concern) {
    return contact;
  }

  const contextConcern = state?.collectedFields?.concern || state?.topic || undefined;
  return contextConcern ? { ...contact, concern: contextConcern } : contact;
}

export function buildConversationState(params: {
  previous: ConversationState | null;
  message: string;
  contact: ContactDetails;
  leadIntent: boolean;
  scheduleIntent: boolean;
  stage?: ConversationState['stage'];
  intakeFlow?: LocalServiceIntakeFlowConfig;
}): ConversationState {
  const text = normalizeText(params.message);
  const inferredIntent = inferConversationIntent(text, params.leadIntent, params.scheduleIntent);
  const topic = inferTopic(params.message, params.previous, params.contact, inferredIntent, params.intakeFlow);
  const urgency = inferUrgency(text) || params.previous?.urgency || null;
  const currentContact = removeEmptyContactFields(params.contact);
  const hasContext = Boolean(
    params.previous ||
      inferredIntent ||
      topic ||
      urgency ||
      Object.keys(currentContact).length > 0,
  );
  const collectedFields = {
    ...params.previous?.collectedFields,
    ...currentContact,
    concern: params.contact.concern || topic || params.previous?.collectedFields?.concern || undefined,
  };
  const normalizedContact: ContactDetails = {
    name: collectedFields.name,
    email: collectedFields.email,
    phone: collectedFields.phone,
    concern: collectedFields.concern,
    location: collectedFields.location,
    urgency: collectedFields.urgency,
  };
  const missingFields = hasContext ? getMissingContactFields(normalizedContact) : [];
  const goal = params.scheduleIntent
    ? 'schedule_call'
    : params.leadIntent
      ? 'capture_lead'
      : params.previous?.goal || (topic ? 'answer_question' : null);

  return {
    intent: inferredIntent || params.previous?.intent || null,
    stage:
      params.stage ||
      params.previous?.stage ||
      (params.scheduleIntent ? 'contact_collection' : topic ? 'discovery' : undefined),
    topic,
    urgency,
    goal,
    collectedFields,
    missingFields,
    nextExpectedField: missingFields[0] || null,
    lastUserIntent: inferredIntent || params.previous?.lastUserIntent || null,
    updatedAt: new Date().toISOString(),
  };
}

export function buildPendingLeadState(params: {
  previous: PendingLeadState | null;
  contact: ContactDetails;
  scheduleIntent: boolean;
  startedByIntent: 'lead' | 'schedule';
}): PendingLeadState {
  const now = new Date().toISOString();
  return {
    status: 'pending',
    intent: params.scheduleIntent ? 'schedule' : params.previous?.intent || params.startedByIntent,
    scheduleIntent: params.scheduleIntent,
    name: params.contact.name,
    email: params.contact.email,
    phone: params.contact.phone,
    concern: params.contact.concern,
    location: params.contact.location,
    urgency: params.contact.urgency,
    preferredContact: params.contact.preferredContact,
    leadPromptCount: (params.previous?.leadPromptCount || 0) + 1,
    lastLeadPromptAt: now,
    leadCapturePaused: false,
    startedAt: params.previous?.startedAt || now,
    updatedAt: now,
  };
}

export function buildPausedLeadState(params: {
  previous: PendingLeadState | null;
  contact: ContactDetails;
  reason: string;
}): PendingLeadState {
  const now = new Date().toISOString();
  return {
    ...params.contact,
    status: 'paused',
    intent: params.previous?.intent || 'lead',
    scheduleIntent: Boolean(params.previous?.scheduleIntent),
    leadPromptCount: params.previous?.leadPromptCount || 0,
    lastLeadPromptAt: params.previous?.lastLeadPromptAt,
    leadCapturePaused: true,
    pauseReason: params.reason,
    pausedAt: now,
    startedAt: params.previous?.startedAt || now,
    updatedAt: now,
  };
}

export function getMissingContactFields(
  contact: ContactDetails,
  localServiceFlow = false,
) {
  const missing: string[] = [];
  if (!contact.concern) {
    missing.push('concern');
  }

  if (localServiceFlow) {
    return getMissingLocalServiceContactFields(contact);
  }

  if (!contact.name) {
    missing.push('name');
  }
  if (!contact.email && !contact.phone) {
    missing.push('contact');
  }
  return missing;
}

export function canAskForLeadDetails(params: {
  missing: string[];
  contact: ContactDetails;
  pendingActive: boolean;
  leadIntent: boolean;
  scheduleIntent: boolean;
  contactFromMessage: ContactDetails;
  leadPromptCount: number;
  text: string;
  localServiceFlow: boolean;
  intakeFlow?: LocalServiceIntakeFlowConfig;
}) {
  if (params.missing.length === 0) {
    return true;
  }

  if (hasRecoveryIntent(params.text) || hasRefusalIntent(params.text) || hasGreetingIntent(params.text)) {
    return false;
  }

  if (params.localServiceFlow && params.pendingActive) {
    return true;
  }

  if (
    params.leadPromptCount >= 1 &&
    !hasLeadProgressSignal(params.contactFromMessage, params.text, params.intakeFlow) &&
    !params.contactFromMessage.preferredContact &&
    !hasBusinessNeedSignal(params.text, params.intakeFlow)
  ) {
    return false;
  }

  if (params.pendingActive && hasLeadProgressSignal(params.contactFromMessage, params.text, params.intakeFlow)) {
    return true;
  }

  if (params.scheduleIntent) {
    return Boolean(
      params.contact.concern ||
        params.contact.preferredContact ||
        hasBusinessNeedSignal(params.text, params.intakeFlow) ||
        (params.localServiceFlow && hasLocalServiceSiteSignal(params.text, params.intakeFlow)),
    );
  }

  if (params.localServiceFlow && (params.contact.location || params.contact.urgency || params.contact.name || params.contact.phone)) {
    return true;
  }

  if (params.leadIntent) {
    return hasBusinessNeedSignal(params.text, params.intakeFlow) || Boolean(params.contact.concern);
  }

  return false;
}

export function hasLeadProgressSignal(contact: ContactDetails, text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return Boolean(
    hasContactSignal(contact) ||
      contact.concern ||
      contact.location ||
      contact.urgency ||
      contact.name ||
      contact.preferredContact ||
      hasBusinessNeedSignal(text, intakeFlow),
  );
}

export function hasLeadCaptureQuality(contact: ContactDetails) {
  return Boolean(
    (contact.email || contact.phone) &&
      (contact.name || contact.concern) &&
      contact.concern,
  );
}

export function shouldQualifyBeforeContact(text: string, contact: ContactDetails) {
  return Boolean(
    contact.concern &&
      /\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|unternehmen|firma|software|lösung|loesung)\b/i.test(
        text,
      ) &&
      !/\b(angebot|preis|kosten|termin|rückruf|rueckruf|kontakt|demo)\b/i.test(text),
  );
}

export function hasRequiredContactFields(requiredFields: string[], collectedFields: ContactDetails) {
  return getMissingRequiredContactFields(requiredFields, collectedFields).length === 0;
}

export function getNextMissingContactField(requiredFields: string[], collectedFields: ContactDetails) {
  return getMissingRequiredContactFields(requiredFields, collectedFields)[0] || null;
}

export function getMissingRequiredContactFields(requiredFields: string[], collectedFields: ContactDetails) {
  return requiredFields
    .map(normalizeContactFieldName)
    .filter((field, index, fields) => field && fields.indexOf(field) === index)
    .filter((field) => !isContactFieldComplete(field, collectedFields));
}

export function isContactFieldComplete(field: string, collectedFields: ContactDetails) {
  const normalized = normalizeContactFieldName(field);
  if (normalized === 'contact') {
    return Boolean(collectedFields.email || collectedFields.phone);
  }
  if (normalized === 'request' || normalized === 'concern') {
    return Boolean(collectedFields.concern);
  }
  if (normalized === 'callback_or_appointment') {
    return Boolean(collectedFields.preferredContact || collectedFields.phone || collectedFields.email);
  }
  return Boolean(collectedFields[normalized as keyof ContactDetails]);
}

export function normalizeContactFieldName(field: string) {
  return field === 'email_or_phone' || field === 'phone_or_email'
    ? 'contact'
    : field === 'request' || field === 'product_or_topic'
      ? 'concern'
      : field;
}

export function mergeContactFields(existing: ContactDetails, extracted: ContactDetails) {
  return removeEmptyContactFields({
    name: extracted.name || existing.name,
    email: extracted.email || existing.email,
    phone: extracted.phone || existing.phone,
    concern: extracted.concern || existing.concern,
    location: extracted.location || existing.location,
    urgency: extracted.urgency || existing.urgency,
    preferredContact: extracted.preferredContact || existing.preferredContact,
  });
}

export function buildContactMetadataPatch(existing: ConversationState | null, extractedFields: ContactDetails) {
  return buildConversationState({
    previous: existing,
    message: extractedFields.concern || '',
    contact: mergeContactDetailsFromState(extractedFields, existing),
    leadIntent: Boolean(extractedFields.concern),
    scheduleIntent: extractedFields.preferredContact === 'phone',
  });
}

export function buildPendingLeadPatch(existingPendingLead: PendingLeadState | null, extractedFields: ContactDetails) {
  return buildPendingLeadState({
    previous: existingPendingLead,
    contact: mergeContactDetails(existingPendingLead, extractedFields),
    scheduleIntent: Boolean(existingPendingLead?.scheduleIntent),
    startedByIntent: existingPendingLead?.intent || 'lead',
  });
}

function extractServiceLocation(
  message: string,
  pendingLead?: PendingLeadState | null,
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  const value = message.trim();
  const fullAddress = extractFullServiceAddress(value);
  if (fullAddress) {
    return fullAddress;
  }

  if (
    pendingLead?.status === 'pending' &&
    Boolean(intakeFlow) &&
    pendingLead.concern &&
    !pendingLead.location &&
    !extractServiceUrgency(value, intakeFlow) &&
    !hasLocalServiceSignal(value, intakeFlow) &&
    !hasCallbackOnlyIntent(value, intakeFlow) &&
    !value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) &&
    !extractPhoneNumber(value)
  ) {
    return undefined;
  }

  return undefined;
}

function extractFullServiceAddress(value: string) {
  const clean = value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/[;:!?]+$/g, '')
    .trim();
  if (!clean || !hasCompleteServiceAddress(clean)) {
    return undefined;
  }
  return clean;
}

function hasCompleteServiceAddress(value: string | undefined) {
  return hasCompleteLocalServiceAddress(value);
}

function hasPartialServiceAddress(value: string) {
  return hasPartialLocalServiceAddress(value);
}

function extractServiceUrgency(message: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (
    /\b(notdienst|notfall|sofort|akut|dringend|eilig|heute|heute noch|wasser steht|läuft über|laeuft ueber)\b/i.test(message) ||
    matchesKeyword(message, (intakeFlow?.genericLocalServiceKeywords || []).filter((keyword) =>
      /notdienst|dringend|heute/i.test(keyword),
    ))
  ) {
    return 'akut';
  }

  if (/\b(planbar|nicht dringend|morgen|termin|terminwunsch|später|spaeter|allgemeine anfrage|nur eine frage)\b/i.test(message)) {
    return 'planbar';
  }

  if (/\b(normal|bald|zeitnah)\b/i.test(message)) {
    return 'normal';
  }

  return undefined;
}

function inferConversationIntent(
  text: string,
  leadIntent: boolean,
  scheduleIntent: boolean,
): ConversationState['intent'] {
  if (scheduleIntent) {
    return 'appointment';
  }
  if (/\b(support|kundenservice|kundensupport|hilfe|fragen|faq)\b/i.test(text)) {
    return 'support';
  }
  if (/\b(ticket|schaden|schadensmeldung|reparatur|defekt)\b/i.test(text)) {
    return 'ticket';
  }
  if (/\b(produkt|shop|kaufen|empfehlung|sortiment)\b/i.test(text)) {
    return 'product_advice';
  }
  if (leadIntent || /\b(kundengewinnung|sales|verkauf|angebot|beratung)\b/i.test(text)) {
    return 'lead';
  }
  return null;
}

function inferTopic(
  message: string,
  previous: ConversationState | null,
  contact: ContactDetails,
  intent: ConversationState['intent'],
  intakeFlow?: LocalServiceIntakeFlowConfig,
) {
  if (contact.concern) {
    return contact.concern;
  }

  const value = message.trim();
  if (!value || isPureContactInput(value) || hasScheduleIntent(normalizeText(value), intakeFlow)) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (isGenericUrgencyQuestion(value, intakeFlow)) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (intent === 'lead' && (isGenericLeadIntent(value) || isGenericLocalServiceIntent(value, intakeFlow))) {
    return previous?.topic || previous?.collectedFields?.concern || null;
  }

  if (/\b(support|kundensupport|kundenservice)\b/i.test(value)) {
    return mergeTopic(previous?.topic, 'Support');
  }

  if (/\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|prozesse|kundengewinnung)\b/i.test(value)) {
    return sanitizeConcern(value);
  }

  return previous?.topic || previous?.collectedFields?.concern || (intent ? sanitizeConcern(value) : null);
}

function mergeTopic(previous: string | null | undefined, next: string) {
  if (!previous) {
    return next;
  }
  if (normalizeText(previous).includes(normalizeText(next))) {
    return previous;
  }
  return `${previous} / ${next}`;
}

function inferUrgency(text: string) {
  if (/(sehr groß|sehr gross|dringend|akut|sofort|\bhoch\b|wichtig|eilig)/i.test(text)) {
    return 'high';
  }
  if (/\b(mittel|normal|bald)\b/i.test(text)) {
    return 'medium';
  }
  if (/\b(niedrig|nicht dringend|später|spaeter)\b/i.test(text)) {
    return 'low';
  }
  return null;
}

function removeEmptyContactFields(contact: ContactDetails): ContactDetails {
  return Object.fromEntries(
    Object.entries(contact).filter(([, value]) => value !== undefined && value !== ''),
  );
}

function isValidPhoneNumber(value: string | undefined) {
  return isValidLocalServicePhoneNumber(value);
}

function hasFullName(value: string | undefined) {
  return hasLocalServiceFullName(value);
}

function isNameToken(value: string) {
  return /^[\p{L}][\p{L}'-]{1,}$/u.test(value);
}

function isStrictNameToken(value: string) {
  return /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+$/.test(value);
}

function isPureContactInput(value: string) {
  return Boolean(
    value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) ||
      value.match(/(?:\+?\d[\d\s()./-]{6,}\d)/) ||
      extractName(value),
  );
}

function cleanExtractedText(value: string) {
  return cleanLocalServiceExtractedText(value);
}

function hasContactSignal(contact: ContactDetails) {
  return Boolean(contact.name || contact.email || contact.phone);
}

function hasGreetingIntent(text: string) {
  const normalized = text.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return false;
  }

  return /^(h+a+l+o+|hsallo|hi+|hey+|guten tag|servus|moin|moinsen|tach|hello)$/i.test(normalized);
}

function hasRecoveryIntent(text: string) {
  return /\b(was soll das|warum fragst du|warum|hä|hae|ich verstehe nicht|verstehe ich nicht|du wiederholst dich|wiederholst dich|nerv nicht|nervt|komisch|quatsch|unsinn)\b/i.test(
    text,
  );
}

function hasRefusalIntent(text: string) {
  return /\b(nein|nope|kein interesse|keine interesse|stop|stopp|lass das|nicht kontaktieren|keine daten|will ich nicht|möchte ich nicht|moechte ich nicht)\b/i.test(
    text,
  );
}

function hasBusinessNeedSignal(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(ki|künstliche intelligenz|kuenstliche intelligenz|automatisierung|support|kundenservice|kundengewinnung|website|webseite|software|unternehmen|firma|projekt|prozess|prozesse|angebot|beratung|lösung|loesung|preis|kosten|termin|rückruf|rueckruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|demo)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function hasLeadIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(beratung|beraten|kontakt|kontaktiert|angebot|kostet|kosten|preis|preise|interesse|interessiere|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie|melden|anfrage|demo|erstgespraech|erstgespräch|lösung|loesung|brauche|benötige|benoetige)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function hasScheduleIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(termin|meeting|kalender|buchen|buchung|telefonat|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie|erstgespraech|erstgespräch|beratungsgespraech|beratungsgespräch)\b/i.test(
      text,
    ) ||
    matchesKeyword(text, intakeFlow?.callbackKeywords || [])
  );
}

function hasLocalServiceSiteSignal(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return Boolean(
    /\b(dienstleister|service|notdienst|handwerker|rohrreinigung|rohr|abfluss|kanal|sanitär|sanitaer|elektriker)\b/i.test(value) ||
      matchesKeyword(value, getLocalServiceKeywords(intakeFlow)),
  );
}

function hasLocalServiceSignal(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(notfall|notdienst|akut|dringend|soforthilfe|toilette|wc|klo|abfluss|rohr|rohrreinigung|kanal|keller|rückstau|rueckstau|verstopft)\b/i.test(text) ||
    matchesKeyword(text, getLocalServiceKeywords(intakeFlow))
  );
}

function isGenericLeadIntent(value: string) {
  const withoutIntentWords = normalizeText(value)
    .replace(
      /\b(ich|wir|brauche|brauchen|möchte|moechte|will|wollen|gern|gerne|bitte|beratung|beraten|kontakt|kontaktiert|angebot|kostet|kosten|preis|preise|interesse|interessiere|rueckruf|rückruf|anrufen|termin|meeting|demo|erstgespraech|erstgespräch|haben|machen|kann|man|einen|eine|ein)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return withoutIntentWords.length < 8;
}

function isGenericScheduleIntent(value: string) {
  const withoutIntentWords = normalizeText(value)
    .replace(
      /\b(ich|wir|moechte|möchte|will|wollen|gern|gerne|bitte|können|koennen|sie|mich|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rueckruf|rückruf|kontakt|telefon|telefonisch|werden)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return withoutIntentWords.length < 8;
}

function isGenericUrgencyQuestion(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  const compact = normalizeText(value)
    .replace(/\b(ist|das|ein|eine|es|bei|mir|schon|wirklich|akuter|akute)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return (
    /^(notfall|dringend|akut)$/.test(compact) ||
    (Boolean(intakeFlow) &&
      /\b(notfall|dringend|akut)\b/i.test(value) &&
      !matchesKeyword(value, intakeFlow?.problemKeywords || []))
  );
}

function hasCallbackOnlyIntent(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|rufen sie mich|telefonisch)\b/i.test(
      value,
    ) && !hasLocalServiceSignal(value, intakeFlow)
  );
}

function isGenericLocalServiceIntent(value: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  const location = extractServiceLocation(value);
  const withoutIntentWords = normalizeText(value)
    .replace(location ? normalizeText(location) : '', '')
    .replace(
      /\b(ich|wir|brauche|brauchen|benoetige|benötige|bitte|notdienst|notfall|soforthilfe|schnelle hilfe|akut|dringend|sofort|in|aus|bei|wohne|bin)\b/g,
      '',
    )
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  return hasLocalServiceSignal(value, intakeFlow) && withoutIntentWords.length < 8;
}

function looksLikeContactOnly(value: string) {
  const withoutEmail = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '');
  const withoutPhone = withoutEmail.replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '');
  return withoutPhone.trim().length < 16;
}

function getLocalServiceKeywords(intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (!intakeFlow) {
    return [];
  }

  return [
    'notfall',
    'akut',
    'soforthilfe',
    ...intakeFlow.genericLocalServiceKeywords,
    ...intakeFlow.problemKeywords,
    ...intakeFlow.callbackKeywords,
  ];
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function normalizeKeyword(value: string) {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keywords: string[] = []) {
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
