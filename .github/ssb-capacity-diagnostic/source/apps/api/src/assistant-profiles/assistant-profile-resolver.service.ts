import { Injectable } from '@nestjs/common';
import {
  normalizeLocalServiceIntakeFlowConfig,
  type LocalServiceIntakeFlowConfig,
} from '../site-modules/module-configs';
import { cloneAssistantProfile, getAssistantProfile } from './assistant-profile-registry';
import {
  AssistantDeliveryChannels,
  AssistantProfile,
  AssistantProfileKey,
  AssistantProfileLegacySource,
  AssistantProfileResolverInput,
  AssistantRequiredField,
} from './assistant-profile.types';

const LOCAL_SERVICE_PROFILE_KEY = 'local-service-first-contact';
const UNIVERSAL_PROFILE_KEY = 'universal-assistant';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function isEnabled(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function resolveProfileKeyFromLegacy(siteConfig: Record<string, unknown>): AssistantProfileKey | null {
  const botType = asString(siteConfig.botType);
  const industry = asString(siteConfig.industry);
  const templateId = asString(siteConfig.templateId);

  if (botType === 'handwerker-first-contact') {
    return LOCAL_SERVICE_PROFILE_KEY;
  }

  if (['local-services', 'local-service-first-contact', 'local_service', 'local-service'].includes(industry)) {
    return LOCAL_SERVICE_PROFILE_KEY;
  }

  if (['local-services', 'local-service-first-contact'].includes(templateId)) {
    return LOCAL_SERVICE_PROFILE_KEY;
  }

  if (industry === 'it-support' || templateId === 'it-support') {
    return 'support-assistant';
  }

  if (industry === 'ecommerce-shopify' || templateId === 'ecommerce-shopify') {
    return 'knowledge-assistant';
  }

  return null;
}

function normalizeFieldLabel(key: string) {
  const labels: Record<string, string> = {
    problem: 'Problem oder Anliegen',
    urgency: 'Dringlichkeit',
    location: 'Ort oder Einsatzbereich',
    fullAddress: 'vollständige Einsatzadresse',
    fullName: 'Vor- und Nachname',
    name: 'Name',
    phone: 'Telefonnummer',
    email: 'E-Mail-Adresse',
  };

  return labels[key] || key;
}

function fieldsFromKeys(
  keys: string[],
  questionTexts: Record<string, unknown>,
  source: AssistantProfileLegacySource,
): AssistantRequiredField[] {
  return keys.map((key) => ({
    key,
    label: normalizeFieldLabel(key),
    required: true,
    question: asString(questionTexts[key]) || undefined,
    source,
  }));
}

function fieldsFromIntakeFlow(flow: LocalServiceIntakeFlowConfig, source: AssistantProfileLegacySource) {
  const orderedKeys = flow.questionOrder.length > 0 ? flow.questionOrder : flow.requiredFields;
  return fieldsFromKeys(orderedKeys, flow.questionTexts, source);
}

function fieldsFromConversationFlow(flow: Record<string, unknown>) {
  const questionTexts = asRecord(flow.questionTexts);
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const fields = asStringArray(flow.fields);
  const orderedKeys = questionOrder.length > 0 ? questionOrder : requiredFields.length > 0 ? requiredFields : fields;
  return orderedKeys.length > 0 ? fieldsFromKeys(orderedKeys, questionTexts, 'conversationFlow') : [];
}

function deliveryChannelsFromSite(siteConfig: Record<string, unknown>): AssistantDeliveryChannels {
  const leadCaptureEnabled = isEnabled(siteConfig.leadCaptureEnabled, false);
  const recipientEmail = asString(siteConfig.leadNotificationEmail);

  return {
    email: {
      enabled: leadCaptureEnabled && Boolean(recipientEmail),
      recipientEmail: recipientEmail || undefined,
    },
    webhook: {
      enabled: false,
    },
  };
}

function mergeLegacyData(
  profile: AssistantProfile,
  siteConfig: Record<string, unknown>,
  fields: AssistantRequiredField[],
  legacySource: AssistantProfileLegacySource,
): AssistantProfile {
  const deliveryChannels = deliveryChannelsFromSite(siteConfig);
  const leadCaptureEnabled = isEnabled(siteConfig.leadCaptureEnabled, profile.handoffRules.enabled);

  return {
    ...cloneAssistantProfile(profile),
    requiredFields: fields.length > 0 ? fields : profile.requiredFields,
    handoffRules: {
      ...profile.handoffRules,
      enabled: leadCaptureEnabled || profile.handoffRules.enabled,
      requireAllFields: fields.length > 0 ? true : profile.handoffRules.requireAllFields,
    },
    deliveryChannels,
    agents: profile.agents.map((agent) => ({
      ...agent,
      requiredFields: fields.length > 0 ? fields : agent.requiredFields,
      integrations: deliveryChannels.email?.enabled
        ? Array.from(new Set([...agent.integrations, 'email']))
        : agent.integrations,
    })),
    legacySource,
  };
}

function normalizeExistingAssistantProfile(value: Record<string, unknown>): AssistantProfile | null {
  const profileKey = asString(value.profileKey);
  const profileVersion = Number(value.profileVersion);
  if (!profileKey || !Number.isInteger(profileVersion) || profileVersion < 1) {
    return null;
  }

  const base = getAssistantProfile(profileKey) || getAssistantProfile(UNIVERSAL_PROFILE_KEY);
  if (!base) {
    return null;
  }

  return {
    ...base,
    ...value,
    profileKey,
    profileVersion,
    requiredFields: Array.isArray(value.requiredFields)
      ? value.requiredFields as AssistantRequiredField[]
      : base.requiredFields,
    deliveryChannels: asRecord(value.deliveryChannels) as AssistantProfile['deliveryChannels'],
    handoffRules: {
      ...base.handoffRules,
      ...asRecord(value.handoffRules),
    },
    conversationEngine: {
      ...base.conversationEngine,
      ...asRecord(value.conversationEngine),
    },
    agents: Array.isArray(value.agents)
      ? value.agents as AssistantProfile['agents']
      : base.agents,
    legacySource: 'assistantProfile',
  };
}

@Injectable()
export class AssistantProfileResolverService {
  resolve(input: AssistantProfileResolverInput): AssistantProfile {
    const siteConfig = asRecord(input.siteConfig);
    const moduleConfigs = asRecord(input.moduleConfigs);
    const assistantConfig = asRecord(siteConfig.assistantProfile);
    const assistantProfileModuleConfig = asRecord(moduleConfigs['assistant-profile']);
    const storedAssistantProfile = asRecord(assistantProfileModuleConfig.assistantProfile);
    const moduleAssistantConfig = asRecord(asRecord(moduleConfigs.assistant).assistantProfile);
    const existingProfile = normalizeExistingAssistantProfile(
      hasKeys(storedAssistantProfile)
        ? storedAssistantProfile
        : hasKeys(moduleAssistantConfig)
          ? moduleAssistantConfig
          : assistantConfig,
    );

    if (existingProfile) {
      return existingProfile;
    }

    const leadSalesConfig = asRecord(moduleConfigs['lead-sales']);
    const leadSalesIntakeFlow = asRecord(leadSalesConfig.intakeFlow);
    if (hasKeys(leadSalesIntakeFlow)) {
      const profile = getAssistantProfile(LOCAL_SERVICE_PROFILE_KEY) || getAssistantProfile(UNIVERSAL_PROFILE_KEY);
      const intakeFlow = normalizeLocalServiceIntakeFlowConfig(leadSalesIntakeFlow);
      return mergeLegacyData(profile!, siteConfig, fieldsFromIntakeFlow(intakeFlow, 'lead-sales.intakeFlow'), 'lead-sales.intakeFlow');
    }

    const conversationFlow = asRecord(siteConfig.conversationFlow);
    if (hasKeys(conversationFlow)) {
      const legacyProfileKey = resolveProfileKeyFromLegacy(siteConfig) || UNIVERSAL_PROFILE_KEY;
      const profile = getAssistantProfile(legacyProfileKey) || getAssistantProfile(UNIVERSAL_PROFILE_KEY);
      return mergeLegacyData(profile!, siteConfig, fieldsFromConversationFlow(conversationFlow), 'conversationFlow');
    }

    const legacyProfileKey = resolveProfileKeyFromLegacy(siteConfig);
    const profile = getAssistantProfile(legacyProfileKey || UNIVERSAL_PROFILE_KEY) || getAssistantProfile(UNIVERSAL_PROFILE_KEY);
    return mergeLegacyData(profile!, siteConfig, [], legacyProfileKey ? 'botType' : 'default');
  }
}
