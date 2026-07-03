import type { AssistantHandoffRules, AssistantRequiredField } from '../assistant-profiles/assistant-profile.types';

export type HandoffFallbackBehavior = 'ask_followup' | 'manual_review' | 'continue_conversation';

export type NormalizedHandoffRules = AssistantHandoffRules & {
  fallbackBehavior: HandoffFallbackBehavior;
};

export type HandoffPolicyReasonCode =
  | 'handoff_disabled'
  | 'missing_required_fields'
  | 'ready_for_scheduled_handoff'
  | 'ready_for_contact_handoff'
  | 'ready_for_capture_only';

export type HandoffPolicyAction = 'suggest_schedule' | 'handoff_to_contact' | 'capture_lead';

export type HandoffPolicyDecision = {
  shouldHandoff: boolean;
  shouldAskForMoreInfo: boolean;
  missingFields: string[];
  requiresSummary: boolean;
  fallbackBehavior: HandoffFallbackBehavior;
  reasonCode: HandoffPolicyReasonCode;
  recommendedAction: HandoffPolicyAction;
};

const DEFAULT_HANDOFF_RULES: NormalizedHandoffRules = {
  enabled: true,
  requireAllFields: false,
  summarizeBeforeHandoff: false,
  handoffWhenUncertain: false,
  fallbackBehavior: 'ask_followup',
};

const FIELD_ALIASES: Record<string, string[]> = {
  contact: ['email', 'phone'],
  request: ['request', 'message', 'concern'],
  product_or_topic: ['product_or_topic', 'product', 'topic'],
  callback_or_appointment: ['callback_or_appointment', 'preferredContact', 'appointment'],
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readBoolean(source: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    if (typeof source[key] === 'boolean') {
      return source[key];
    }
  }
  return fallback;
}

function normalizeFallbackBehavior(value: unknown): HandoffFallbackBehavior {
  if (value === 'manual_review' || value === 'continue_conversation' || value === 'ask_followup') {
    return value;
  }
  return DEFAULT_HANDOFF_RULES.fallbackBehavior;
}

function hasCollectedValue(collectedFields: Record<string, unknown>, key: string): boolean {
  const aliases = FIELD_ALIASES[key] || [key];
  return aliases.some((alias) => {
    const value = collectedFields[alias];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  });
}

function normalizeRequiredFieldKey(field: AssistantRequiredField | string): string | null {
  if (typeof field === 'string') {
    return field.trim() || null;
  }

  return typeof field.key === 'string' && field.key.trim() ? field.key.trim() : null;
}

function isRequiredField(field: AssistantRequiredField | string): boolean {
  return typeof field === 'string' ? true : field.required !== false;
}

export function normalizeHandoffRules(input?: unknown): NormalizedHandoffRules {
  const source = asRecord(input);
  return {
    enabled: readBoolean(source, ['enabled'], DEFAULT_HANDOFF_RULES.enabled),
    requireAllFields: readBoolean(
      source,
      ['requireAllFields', 'requiredBeforeHandoff'],
      DEFAULT_HANDOFF_RULES.requireAllFields,
    ),
    summarizeBeforeHandoff: readBoolean(
      source,
      ['summarizeBeforeHandoff', 'summaryBeforeHandoff'],
      DEFAULT_HANDOFF_RULES.summarizeBeforeHandoff,
    ),
    handoffWhenUncertain: readBoolean(
      source,
      ['handoffWhenUncertain'],
      DEFAULT_HANDOFF_RULES.handoffWhenUncertain,
    ),
    instructions: typeof source.instructions === 'string' ? source.instructions : undefined,
    fallbackBehavior: normalizeFallbackBehavior(source.fallbackBehavior),
  };
}

export function isHandoffEnabled(input?: unknown): boolean {
  return normalizeHandoffRules(input).enabled;
}

export function getHandoffFallbackBehavior(input?: unknown): HandoffFallbackBehavior {
  return normalizeHandoffRules(input).fallbackBehavior;
}

export function shouldRequireFieldsBeforeHandoff(input?: unknown): boolean {
  return normalizeHandoffRules(input).requireAllFields;
}

export function shouldRequireSummaryBeforeHandoff(input?: unknown): boolean {
  return normalizeHandoffRules(input).summarizeBeforeHandoff;
}

export function getMissingFieldsBeforeHandoff(
  requiredFields: Array<AssistantRequiredField | string> = [],
  collectedFields: Record<string, unknown> = {},
): string[] {
  const missing: string[] = [];
  for (const field of requiredFields) {
    const key = normalizeRequiredFieldKey(field);
    if (!key || !isRequiredField(field)) {
      continue;
    }
    if (!hasCollectedValue(collectedFields, key)) {
      missing.push(key);
    }
  }
  return missing;
}

export function hasRequiredFieldsForHandoff(
  requiredFields: Array<AssistantRequiredField | string> = [],
  collectedFields: Record<string, unknown> = {},
): boolean {
  return getMissingFieldsBeforeHandoff(requiredFields, collectedFields).length === 0;
}

export function canPrepareHandoff(input: {
  handoffRules?: unknown;
  requiredFields?: Array<AssistantRequiredField | string>;
  collectedFields?: Record<string, unknown>;
}): boolean {
  const rules = normalizeHandoffRules(input.handoffRules);
  if (!rules.enabled) {
    return false;
  }
  if (!rules.requireAllFields) {
    return true;
  }
  return hasRequiredFieldsForHandoff(input.requiredFields || [], input.collectedFields || {});
}

export function shouldPrepareHandoff(input: {
  handoffRules?: unknown;
  requiredFields?: Array<AssistantRequiredField | string>;
  collectedFields?: Record<string, unknown>;
  handoffRequested?: boolean;
  uncertain?: boolean;
}): boolean {
  const rules = normalizeHandoffRules(input.handoffRules);
  const requested = Boolean(input.handoffRequested || (input.uncertain && rules.handoffWhenUncertain));
  return requested && canPrepareHandoff(input);
}

export function shouldDeferHandoff(input: {
  handoffRules?: unknown;
  requiredFields?: Array<AssistantRequiredField | string>;
  collectedFields?: Record<string, unknown>;
  handoffRequested?: boolean;
  uncertain?: boolean;
}): boolean {
  const rules = normalizeHandoffRules(input.handoffRules);
  const requested = Boolean(input.handoffRequested || (input.uncertain && rules.handoffWhenUncertain));
  return requested && !canPrepareHandoff(input);
}

export function buildHandoffPolicyDecision(input: {
  handoffRules?: unknown;
  requiredFields?: Array<AssistantRequiredField | string>;
  collectedFields?: Record<string, unknown>;
  hasScheduleTarget?: boolean;
  hasContactRequest?: boolean;
}): HandoffPolicyDecision {
  const rules = normalizeHandoffRules(input.handoffRules);
  const missingFields = rules.requireAllFields
    ? getMissingFieldsBeforeHandoff(input.requiredFields || [], input.collectedFields || {})
    : [];
  const shouldAskForMoreInfo = rules.enabled && missingFields.length > 0;
  const recommendedAction = input.hasScheduleTarget
    ? 'suggest_schedule'
    : input.hasContactRequest
      ? 'handoff_to_contact'
      : 'capture_lead';
  const reasonCode: HandoffPolicyReasonCode = !rules.enabled
    ? 'handoff_disabled'
    : shouldAskForMoreInfo
      ? 'missing_required_fields'
      : recommendedAction === 'suggest_schedule'
        ? 'ready_for_scheduled_handoff'
        : recommendedAction === 'handoff_to_contact'
          ? 'ready_for_contact_handoff'
          : 'ready_for_capture_only';

  return {
    shouldHandoff: rules.enabled && !shouldAskForMoreInfo && recommendedAction !== 'capture_lead',
    shouldAskForMoreInfo,
    missingFields,
    requiresSummary: rules.summarizeBeforeHandoff,
    fallbackBehavior: rules.fallbackBehavior,
    reasonCode,
    recommendedAction,
  };
}

export function selectPostCaptureHandoffAction(input: {
  hasScheduleTarget?: boolean;
  hasContactRequest?: boolean;
}): HandoffPolicyAction {
  return buildHandoffPolicyDecision({
    handoffRules: DEFAULT_HANDOFF_RULES,
    hasScheduleTarget: input.hasScheduleTarget,
    hasContactRequest: input.hasContactRequest,
  }).recommendedAction;
}
