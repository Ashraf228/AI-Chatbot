import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { SiteModulesService } from '../site-modules/site-modules.service';
import { AssistantProfileDiagnosticsService } from './assistant-profile-diagnostics.service';
import { getAssistantProfile } from './assistant-profile-registry';
import {
  AssistantDeliveryChannels,
  AssistantHandoffRules,
  AssistantProfile,
  AssistantRequiredField,
} from './assistant-profile.types';

const STORAGE_LOCATION = 'site_modules[assistant-profile].config.assistantProfile';

const ALLOWED_ENABLED_TASKS = new Set([
  'answer_questions',
  'collect_requests',
  'support',
  'product_advice',
  'appointment',
  'prepare_handoff',
  'create_ticket',
  'trigger_integration',
]);

const ALLOWED_REQUIRED_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'request',
  'product_or_topic',
  'customer_number',
  'priority',
  'callback_or_appointment',
  'custom',
]);

const ALLOWED_KNOWLEDGE_MODES = new Set(['strict', 'grounded', 'flexible']);
const ALLOWED_TONES = new Set(['formal', 'friendly', 'professional', 'consultative', 'neutral', 'warm']);
const ALLOWED_ANSWER_STYLES = new Set(['concise', 'short', 'structured', 'guided', 'knowledge_first']);
const ALLOWED_DELIVERY_CHANNELS = new Set(['email', 'webhook', 'system']);

type SaveAssistantProfileInput = {
  assistantProfile?: unknown;
  updatedFrom?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fieldName: string, options: { required?: boolean; max?: number } = {}) {
  if (typeof value !== 'string') {
    if (options.required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return '';
  }

  const trimmed = value.trim();
  if (options.required && !trimmed) {
    throw new BadRequestException(`${fieldName} is required`);
  }
  if (options.max && trimmed.length > options.max) {
    throw new BadRequestException(`${fieldName} is too long`);
  }
  return trimmed;
}

function asStringArray(value: unknown, fieldName: string, allowed?: Set<string>) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }

  const values = value.map((entry) => {
    if (typeof entry !== 'string') {
      throw new BadRequestException(`${fieldName} must contain strings`);
    }
    const normalized = entry.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} contains an empty value`);
    }
    if (allowed && !allowed.has(normalized)) {
      throw new BadRequestException(`Invalid ${fieldName}: ${normalized}`);
    }
    return normalized;
  });

  return Array.from(new Set(values));
}

function sanitizeRequiredFields(value: unknown): AssistantRequiredField[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new BadRequestException('requiredFields must be an array');
  }

  return value.map((entry) => {
    const field = typeof entry === 'string' ? { key: entry } : asRecord(entry);
    const key = asString(field.key, 'requiredFields.key', { required: true, max: 80 });
    if (!ALLOWED_REQUIRED_FIELDS.has(key)) {
      throw new BadRequestException(`Invalid requiredFields key: ${key}`);
    }

    return {
      key,
      label: asString(field.label, 'requiredFields.label', { max: 120 }) || key,
      required: typeof field.required === 'boolean' ? field.required : true,
      question: asString(field.question, 'requiredFields.question', { max: 240 }) || undefined,
    };
  });
}

function sanitizeHandoffRules(value: unknown, base: AssistantHandoffRules): AssistantHandoffRules {
  const source = asRecord(value);
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : base.enabled,
    requireAllFields:
      typeof source.requiredBeforeHandoff === 'boolean'
        ? source.requiredBeforeHandoff
        : typeof source.requireAllFields === 'boolean'
          ? source.requireAllFields
          : base.requireAllFields,
    summarizeBeforeHandoff:
      typeof source.summaryBeforeHandoff === 'boolean'
        ? source.summaryBeforeHandoff
        : typeof source.summarizeBeforeHandoff === 'boolean'
          ? source.summarizeBeforeHandoff
          : base.summarizeBeforeHandoff,
    handoffWhenUncertain:
      typeof source.handoffWhenUncertain === 'boolean'
        ? source.handoffWhenUncertain
        : base.handoffWhenUncertain,
    instructions: asString(source.fallbackBehavior || source.instructions, 'handoffRules.instructions', { max: 500 }) || undefined,
  };
}

function sanitizeDeliveryChannels(value: unknown): AssistantDeliveryChannels {
  const source = asRecord(value);
  const email = asRecord(source.email);
  const webhook = asRecord(source.webhook);
  const system = asRecord(source.system);

  for (const [channelType, rawChannel] of Object.entries(source)) {
    if (!ALLOWED_DELIVERY_CHANNELS.has(channelType)) {
      throw new BadRequestException(`Invalid delivery channel: ${channelType}`);
    }
    asRecord(rawChannel);
  }

  return {
    email: {
      enabled: typeof email.enabled === 'boolean' ? email.enabled : false,
      recipientEmail: asString(email.recipientEmail, 'deliveryChannels.email.recipientEmail', { max: 254 }) || undefined,
    },
    webhook: {
      enabled: typeof webhook.enabled === 'boolean' ? webhook.enabled : false,
    },
    system: {
      enabled: typeof system.enabled === 'boolean' ? system.enabled : false,
    },
  };
}

function sanitizeAssistantProfile(value: unknown): AssistantProfile {
  const source = asRecord(value);
  const profileKey = asString(source.profileKey || source.key, 'assistantProfile.profileKey', {
    required: true,
    max: 80,
  });
  const base = getAssistantProfile(profileKey);
  if (!base) {
    throw new BadRequestException(`Invalid assistantProfile.profileKey: ${profileKey}`);
  }

  const profileVersionInput = source.profileVersion ?? source.version ?? base.profileVersion;
  const profileVersion = Number(profileVersionInput);
  if (!Number.isInteger(profileVersion) || profileVersion < 1) {
    throw new BadRequestException('assistantProfile.profileVersion must be a positive integer');
  }

  const knowledgeMode = asString(source.knowledgeMode, 'assistantProfile.knowledgeMode', { max: 40 }) || base.knowledgeMode;
  if (!ALLOWED_KNOWLEDGE_MODES.has(knowledgeMode)) {
    throw new BadRequestException(`Invalid assistantProfile.knowledgeMode: ${knowledgeMode}`);
  }

  const tone = asString(source.tone, 'assistantProfile.tone', { max: 40 }) || base.tone;
  if (!ALLOWED_TONES.has(tone)) {
    throw new BadRequestException(`Invalid assistantProfile.tone: ${tone}`);
  }

  const answerStyle = asString(source.answerStyle, 'assistantProfile.answerStyle', { max: 40 }) || base.answerStyle;
  if (!ALLOWED_ANSWER_STYLES.has(answerStyle)) {
    throw new BadRequestException(`Invalid assistantProfile.answerStyle: ${answerStyle}`);
  }

  const enabledTasks =
    source.enabledTasks === undefined
      ? base.enabledTasks
      : asStringArray(source.enabledTasks, 'enabledTasks', ALLOWED_ENABLED_TASKS);

  return {
    ...base,
    profileKey,
    profileVersion,
    assistantName:
      asString(source.assistantName, 'assistantProfile.assistantName', { max: 120 }) || base.assistantName,
    role: asString(source.role, 'assistantProfile.role', { max: 160 }) || base.role,
    businessDescription: asString(source.businessDescription, 'assistantProfile.businessDescription', { max: 1200 }),
    targetUsers: asStringArray(source.targetUsers, 'targetUsers').map((entry) => entry.slice(0, 120)),
    tone: tone as AssistantProfile['tone'],
    answerStyle: answerStyle as AssistantProfile['answerStyle'],
    knowledgeMode: knowledgeMode as AssistantProfile['knowledgeMode'],
    enabledTasks,
    enabledAgents: Array.isArray(source.enabledAgents)
      ? asStringArray(source.enabledAgents, 'enabledAgents')
      : base.enabledAgents,
    requiredFields: sanitizeRequiredFields(source.requiredFields),
    handoffRules: sanitizeHandoffRules(source.handoffRules, base.handoffRules),
    deliveryChannels: sanitizeDeliveryChannels(source.deliveryChannels),
    legacySource: 'assistantProfile',
  };
}

@Injectable()
export class AssistantProfileSaveService {
  constructor(
    private readonly diagnostics: AssistantProfileDiagnosticsService,
    private readonly siteModules: SiteModulesService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async saveAssistantProfile(
    siteId: string,
    input: SaveAssistantProfileInput,
    tenantId?: string | null,
    actorId?: string | null,
  ) {
    const assistantProfile = sanitizeAssistantProfile(input.assistantProfile);
    const updatedAt = new Date().toISOString();
    const updatedFrom = asString(input.updatedFrom, 'updatedFrom', { max: 80 }) || 'admin-api';
    const storageConfig = {
      assistantProfile,
      metadata: {
        updatedAt,
        updatedBy: actorId || 'dashboard',
        updatedFrom,
        legacyFieldsPreserved: true,
        reversible: true,
        storageLocation: STORAGE_LOCATION,
      },
    };

    await this.siteModules.updateForSite(siteId, [
      {
        key: 'assistant-profile',
        isEnabled: true,
        config: storageConfig,
      },
    ]);

    await this.auditLogs.record({
      siteId,
      tenantId: tenantId || null,
      actorId: actorId || 'dashboard',
      actorRole: 'operator',
      action: 'update_assistant_profile',
      resourceType: 'assistant_profile',
      resourceId: siteId,
      metadata: {
        profileKey: assistantProfile.profileKey,
        profileVersion: assistantProfile.profileVersion,
        updatedFrom,
        legacyFieldsPreserved: true,
        reversible: true,
        storageLocation: STORAGE_LOCATION,
      },
    });

    return {
      saved: true,
      storageLocation: STORAGE_LOCATION,
      metadata: storageConfig.metadata,
      assistantProfileDebug: (await this.diagnostics.getDiagnostics(siteId)).assistantProfileDebug,
    };
  }
}
