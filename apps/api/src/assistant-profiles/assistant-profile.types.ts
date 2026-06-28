export type AssistantProfileKey =
  | 'universal-assistant'
  | 'knowledge-assistant'
  | 'support-assistant'
  | 'sales-assistant'
  | 'local-service-first-contact';

export type AssistantProfileLegacySource =
  | 'assistantProfile'
  | 'lead-sales.intakeFlow'
  | 'conversationFlow'
  | 'botType'
  | 'industry'
  | 'templateId'
  | 'default';

export type AssistantRequiredField = {
  key: string;
  label: string;
  required: boolean;
  question?: string;
  source?: AssistantProfileLegacySource;
};

export type AssistantHandoffRules = {
  enabled: boolean;
  requireAllFields: boolean;
  summarizeBeforeHandoff: boolean;
  handoffWhenUncertain: boolean;
  instructions?: string;
};

export type AssistantDeliveryChannels = {
  email?: {
    enabled: boolean;
    recipientEmail?: string;
  };
  webhook?: {
    enabled: boolean;
  };
};

export type ConversationEngineConfig = {
  enabled: boolean;
  autoDetectIntent: boolean;
  autoSelectAgent: boolean;
  askOnlyOneQuestionAtATime: boolean;
  maxQuestionsBeforeSummary: number;
  summarizeBeforeHandoff: boolean;
  handoffWhenUncertain: boolean;
};

export type AgentConfig = {
  key: string;
  label: string;
  purpose: string;
  enabled: boolean;
  triggerMode: 'manual' | 'intent' | 'always';
  allowedActions: string[];
  requiredFields: AssistantRequiredField[];
  escalationRules: string[];
  knowledgeScope: 'site' | 'tenant' | 'global';
  integrations: string[];
};

export type AssistantProfile = {
  profileKey: AssistantProfileKey | string;
  profileVersion: number;
  assistantName: string;
  role: string;
  businessDescription: string;
  targetUsers: string[];
  tone: 'formal' | 'friendly' | 'professional' | 'consultative';
  answerStyle: 'short' | 'structured' | 'guided' | 'knowledge_first';
  knowledgeMode: 'strict' | 'flexible' | 'disabled';
  enabledTasks: string[];
  enabledAgents: string[];
  requiredFields: AssistantRequiredField[];
  handoffRules: AssistantHandoffRules;
  deliveryChannels: AssistantDeliveryChannels;
  conversationEngine: ConversationEngineConfig;
  agents: AgentConfig[];
  legacySource: AssistantProfileLegacySource;
};

export type AssistantProfileResolverInput = {
  siteConfig?: Record<string, unknown> | null;
  moduleConfigs?: Record<string, Record<string, unknown> | null | undefined> | null;
};
