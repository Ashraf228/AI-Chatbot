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
  status: "pending" | "processing" | "ready" | "failed" | "disabled" | string;
  syncStatus: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  errorMessage: string;
  createdAt: string;
};

export type WizardStepKey = "customer" | "bot" | "delivery" | "flow" | "knowledge" | "design" | "launch";
export type KnowledgeMethod = "manual" | "url" | "pdf";

export type WizardStep = {
  key: WizardStepKey;
  label: string;
  description: string;
};

export type TestChatMessage = {
  role: "user" | "assistant";
  text: string;
  sources?: Array<{ title?: string; url?: string; score?: number }>;
};
