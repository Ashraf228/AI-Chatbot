import type { DashboardSessionRole } from "../../../lib/auth";

export type CustomerSetupWizardProps = {
  siteId: string;
  dashboardRole?: DashboardSessionRole | null;
};

export type KnowledgeMode = "flexible" | "grounded" | "strict";
export type FallbackBehavior = "ask_followup" | "collect_contact" | "handoff";
export type PrimaryGoal =
  | "support_automation"
  | "lead_generation"
  | "customer_advice"
  | "product_questions"
  | "appointment_requests"
  | "internal_knowledge";
export type Tone = "professional" | "friendly" | "premium" | "direct" | "consultative";

export type SiteDetails = {
  id: string;
  name: string;
  siteKey: string;
  allowedDomains: string[];
  companyName: string;
  websiteUrl: string;
  supportEmail: string;
  phone: string;
  language: "de" | "en";
  botName: string;
  logoUrl: string;
  brandColor: string;
  accentColor: string;
  welcomeMessage: string;
  placeholderText: string;
  widgetPosition: "bottom_right" | "bottom_left";
  launcherLabel: string;
  privacyUrl: string;
  privacyNoticeText: string;
  fontFamily: string;
  systemPrompt: string;
  industry: string;
  botType: string;
  setupGoal: string;
  primaryGoal: PrimaryGoal | "";
  tone: Tone | "";
  knowledgeMode: KnowledgeMode;
  fallbackBehavior: FallbackBehavior;
  conversationFlow: Record<string, unknown>;
  enabledTasks: string[];
  assistantProfile: Record<string, unknown> | null;
  ctaText: string;
  leadCaptureEnabled: boolean;
  leadNotificationEmail: string;
  consentRequired: boolean;
  templateId: string;
  templateVersion: number | null;
  templateAppliedAt: string;
  lastTestedAt: string;
  lastTestQuestion: string;
  lastTestAnswer: string;
  goLiveAt: string;
};

export type CustomerProfileForm = {
  companyName: string;
  botName: string;
  industry: string;
  websiteUrl: string;
  allowedDomains: string;
  supportEmail: string;
  phone: string;
  language: "de" | "en";
};

export type SetupGoalForm = {
  primaryGoal: SiteDetails["primaryGoal"];
  botType: string;
  tone: SiteDetails["tone"];
  knowledgeMode: KnowledgeMode;
  fallbackBehavior: FallbackBehavior;
  ctaText: string;
  systemPrompt: string;
};

export type LeadDeliveryForm = {
  leadCaptureEnabled: boolean;
  leadNotificationEmail: string;
};

export type ConversationFlowForm = {
  requiredFields: string[];
  enabledTasks: string[];
};

export type DesignPrivacyForm = {
  brandColor: string;
  accentColor: string;
  logoUrl: string;
  welcomeMessage: string;
  placeholderText: string;
  widgetPosition: "bottom_right" | "bottom_left";
  launcherLabel: string;
  privacyUrl: string;
  privacyNoticeText: string;
  consentRequired: boolean;
};

export type KnowledgeDraftForm = {
  title: string;
  question: string;
  content: string;
  url: string;
  urlTitle: string;
};

export type KnowledgeSource = {
  id: string;
  type: string;
  title: string;
  label: string;
  url: string;
  sourceUrl: string;
  normalizedSourceUrl?: string;
  sourceDomain?: string;
  status: "pending" | "processing" | "ready" | "failed" | "disabled" | string;
  syncStatus: string;
  ingestStatus?: string;
  indexStatus?: string;
  runtimeReadiness?: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  errorMessage: string;
  ingestErrorMessageSanitized?: string;
  createdAt: string;
};

export type WizardStepKey = "customer" | "bot" | "delivery" | "flow" | "knowledge" | "design" | "launch";
export type KnowledgeMethod = "manual" | "url" | "pdf";

export type WizardStep = {
  key: WizardStepKey;
  label: string;
  description: string;
};

export type InternalTestChatKnowledgeSnippet = {
  id?: string;
  title?: string;
  url?: string;
  score?: number;
  excerpt?: string;
  sourceType?: string;
  scope?: string;
};

export type InternalTestChatRuntimePilotResult = {
  runtimePilotEnabled?: boolean;
  activationBoundary?: {
    mode: string;
    publicWidgetActivation: boolean;
    productionActivation: boolean;
    deployRequired: boolean;
  };
  sideEffects?: {
    planned: boolean;
    ticketDelivery: boolean;
    emailDelivery: boolean;
    webhookDelivery: boolean;
    providerCalls: boolean;
    dbAccessForNewLogic: boolean;
    sql: boolean;
    queryRunner: boolean;
  };
  runtimeState?: {
    selectedAgentKey: string | null;
    nextActionKey: string | null;
    shouldHandoff: boolean;
    shouldAskQuestion: boolean;
    handoffOfferSimulated: boolean;
    ticketFieldRequestSimulated: boolean;
    sourcesUsed: number;
    sourceRequired: boolean;
  };
  conversationEnginePreview?: {
    intent: string;
    goal: string;
    stage: string;
    selectedAgentKey: string | null;
    nextAction: string;
    shouldHandoff: boolean;
    missingFields: string[];
  } | null;
  engineResponsePreview?: {
    draft: null | {
      text: string;
      nextActionLabel?: string;
    };
    safety?: {
      noSideEffects: true;
      publicWidgetUnaffected: true;
      integrationsSuppressed: true;
      sanitized: true;
    };
  } | null;
  knowledgeRetrieval?: {
    enabled: boolean;
    attempted: boolean;
    status: string;
    snippets: InternalTestChatKnowledgeSnippet[];
    warnings?: string[];
    reasons?: string[];
  } | null;
  warnings?: string[];
  reasons?: string[];
};

export type InternalTestChatTurn = {
  id: string;
  testedAt: string;
  userMessage: string;
  assistantDraft: string;
  result: InternalTestChatRuntimePilotResult;
  usedKnowledgeSnippets: InternalTestChatKnowledgeSnippet[];
};
