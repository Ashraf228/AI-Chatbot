export type LegacyRoutingMode = 'universal' | 'local_service_legacy' | 'legacy_other';

export type LegacyRoutingGuardInput = {
  botType?: unknown;
  industry?: unknown;
  industryTemplate?: unknown;
  templateId?: unknown;
  profileKey?: unknown;
  assistantProfile?: unknown;
  conversationFlow?: unknown;
  leadSalesIntakeFlow?: unknown;
  intakeFlow?: unknown;
  enabledTasks?: unknown;
  requiredFields?: unknown;
  leadCaptureEnabled?: unknown;
};

const LOCAL_SERVICE_KEYS = new Set([
  'local-service-first-contact',
  'local-services',
  'local-service',
]);

const UNIVERSAL_KEYS = new Set([
  'generic',
  'universal-assistant',
]);

const GENERIC_REQUIRED_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'request',
  'customer-number',
  'customer_number',
  'product-or-topic',
  'product_or_topic',
  'priority',
  'callback-or-appointment',
  'callback_or_appointment',
  'custom',
]);

const GENERIC_ENABLED_TASKS = new Set([
  'answer-questions',
  'answer_questions',
  'collect-requests',
  'collect_requests',
  'support',
  'product-advice',
  'product_advice',
  'appointment',
  'prepare-handoff',
  'prepare_handoff',
  'create-ticket',
  'create_ticket',
  'trigger-integration',
  'trigger_integration',
]);

export function getLegacyRoutingMode(input: LegacyRoutingGuardInput): LegacyRoutingMode {
  if (isExplicitLegacyLocalServiceConfig(input)) {
    return 'local_service_legacy';
  }

  if (hasNonUniversalLegacyMarker(input)) {
    return 'legacy_other';
  }

  return 'universal';
}

export function isUniversalAssistantConfig(input: LegacyRoutingGuardInput): boolean {
  return getLegacyRoutingMode(input) === 'universal';
}

export function isExplicitLegacyLocalServiceConfig(input: LegacyRoutingGuardInput): boolean {
  const assistantProfile = asObject(input.assistantProfile);
  const conversationFlow = asObject(input.conversationFlow);
  const leadSalesIntakeFlow = asObject(input.leadSalesIntakeFlow ?? input.intakeFlow);

  return Boolean(
    normalizeKey(input.botType) === 'handwerker-first-contact' ||
      isLocalServiceKey(input.industry) ||
      isLocalServiceKey(input.industryTemplate) ||
      isLocalServiceKey(input.templateId) ||
      isLocalServiceKey(input.profileKey) ||
      isLocalServiceKey(assistantProfile.profileKey) ||
      isLocalServiceLegacySource(assistantProfile.legacySource) ||
      isLocalServiceKey(conversationFlow.profileKey) ||
      isLocalServiceKey(conversationFlow.templateKey) ||
      isLocalServiceKey(conversationFlow.templateId) ||
      isLocalServiceKey(leadSalesIntakeFlow.profileKey) ||
      isLocalServiceKey(leadSalesIntakeFlow.templateKey) ||
      isLocalServiceKey(leadSalesIntakeFlow.templateId) ||
      isExplicitLocalServiceIntakeFlow(conversationFlow) ||
      isExplicitLocalServiceIntakeFlow(leadSalesIntakeFlow)
  );
}

export function isExplicitLocalServiceIntakeFlow(value: unknown): boolean {
  const flow = asObject(value);
  if (Object.keys(flow).length === 0) {
    return false;
  }

  if (isLocalServiceKey(flow.templateKey) || isLocalServiceKey(flow.templateId) || isLocalServiceKey(flow.profileKey)) {
    return true;
  }

  const questionTexts = asObject(flow.questionTexts);
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const hasAddressQuestion = Boolean(asString(questionTexts.fullAddress) || asString(questionTexts.location));
  const hasLocalField =
    requiredFields.includes('fullAddress') ||
    requiredFields.includes('location') ||
    requiredFields.includes('urgency') ||
    requiredFields.includes('problem');
  const hasLocalOrder =
    questionOrder.includes('fullAddress') ||
    questionOrder.includes('location') ||
    questionOrder.includes('urgency') ||
    questionOrder.includes('problem');

  return Boolean(hasAddressQuestion && hasLocalField && hasLocalOrder);
}

function hasNonUniversalLegacyMarker(input: LegacyRoutingGuardInput) {
  const assistantProfile = asObject(input.assistantProfile);
  const markers = [
    input.botType,
    input.industry,
    input.industryTemplate,
    input.templateId,
    input.profileKey,
    assistantProfile.profileKey,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  return markers.some((marker) => !UNIVERSAL_KEYS.has(marker) && !LOCAL_SERVICE_KEYS.has(marker));
}

function isLocalServiceLegacySource(value: unknown) {
  const normalized = normalizeKey(value);
  return normalized === 'local-service' || normalized === 'local-service-first-contact';
}

function isLocalServiceKey(value: unknown) {
  return LOCAL_SERVICE_KEYS.has(normalizeKey(value));
}

function normalizeKey(value: unknown) {
  return asString(value).toLowerCase().replace(/_/g, '-');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function hasOnlyGenericRequiredFields(value: unknown): boolean {
  const fields = asStringArray(value).map(normalizeKey);
  return fields.length > 0 && fields.every((field) => GENERIC_REQUIRED_FIELDS.has(field));
}

export function hasOnlyGenericEnabledTasks(value: unknown): boolean {
  const tasks = asStringArray(value).map(normalizeKey);
  return tasks.length > 0 && tasks.every((task) => GENERIC_ENABLED_TASKS.has(task));
}
