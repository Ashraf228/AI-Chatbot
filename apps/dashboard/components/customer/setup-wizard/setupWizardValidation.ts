import type { CustomerApiStatus, CustomerStatusStep, CustomerStatusTone } from "../customer-status";
import {
  DEFAULT_BOT_TYPE,
  DEFAULT_ENABLED_TASKS,
  DEFAULT_PRIMARY_GOAL,
  DEFAULT_REQUIRED_FIELDS,
  DEFAULT_TONE,
  ENABLED_TASK_OPTIONS,
  PRIMARY_GOAL_VALUES,
  REQUIRED_FIELD_OPTIONS,
  STATUS_STEP_GROUPS,
} from "./setupWizardConstants";
import type { FallbackBehavior, KnowledgeMode, KnowledgeSource, PrimaryGoal, SiteDetails, WizardStepKey } from "./setupWizardTypes";

export function normalizeDomains(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function domainFromUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0] || trimmed;
  }
}

function firstString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const REQUIRED_FIELD_KEYS = new Set<string>(REQUIRED_FIELD_OPTIONS.map((option) => option.key));
const ENABLED_TASK_KEYS = new Set<string>(ENABLED_TASK_OPTIONS.map((option) => option.key));

export function normalizeRequiredFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_REQUIRED_FIELDS];
  }

  const keys = value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      const field = recordValue(entry);
      return firstString(field?.key);
    })
    .filter((entry) => REQUIRED_FIELD_KEYS.has(entry));
  return keys;
}

export function normalizeEnabledTasks(value: unknown) {
  const keys = stringArray(value).filter((entry) => ENABLED_TASK_KEYS.has(entry));
  return keys.length > 0 ? keys : [...DEFAULT_ENABLED_TASKS];
}

function normalizeAssistantProfilePrimaryGoal(value: unknown): PrimaryGoal | "" {
  const raw = firstString(value);
  return PRIMARY_GOAL_VALUES.has(raw) ? (raw as PrimaryGoal) : "";
}

function normalizePrimaryGoalFromAssistantRole(value: unknown): PrimaryGoal | "" {
  const raw = firstString(value).trim().toLowerCase();
  if (!raw) {
    return "";
  }

  const roleMap: Record<string, PrimaryGoal> = {
    "support und kundenhilfe": "support_automation",
    "anfragen aufnehmen und qualifizieren": "lead_generation",
    "kunden beraten": "customer_advice",
    "produkt- und leistungsfragen beantworten": "product_questions",
    "termine und rückrufe vorbereiten": "appointment_requests",
    "wissen strukturiert bereitstellen": "internal_knowledge",
  };

  return roleMap[raw] || "";
}

function normalizePrimaryGoalFromTasks(value: unknown): PrimaryGoal | "" {
  const tasks = stringArray(value).filter((entry) => ENABLED_TASK_KEYS.has(entry));
  if (tasks.length === 0) {
    return "";
  }

  if (tasks.includes("support") || tasks.includes("create_ticket")) {
    return "support_automation";
  }
  if (tasks.includes("product_advice")) {
    return "product_questions";
  }
  if (tasks.includes("appointment")) {
    return "appointment_requests";
  }
  if (tasks.includes("answer_questions") && tasks.includes("collect_requests")) {
    return "lead_generation";
  }
  if (tasks.includes("answer_questions")) {
    return "customer_advice";
  }
  return "";
}

export function normalizePrimaryGoal(
  primaryGoal: unknown,
  setupGoal: unknown,
  assistantProfile?: Record<string, unknown> | null,
  enabledTasks?: unknown,
): PrimaryGoal | "" {
  const profilePrimaryGoal = normalizeAssistantProfilePrimaryGoal(assistantProfile?.primaryGoal);
  if (profilePrimaryGoal) {
    return profilePrimaryGoal;
  }

  const rawPrimaryGoal = firstString(primaryGoal);
  if (PRIMARY_GOAL_VALUES.has(rawPrimaryGoal)) {
    return rawPrimaryGoal as PrimaryGoal;
  }

  const rolePrimaryGoal = normalizePrimaryGoalFromAssistantRole(assistantProfile?.role);
  if (rolePrimaryGoal) {
    return rolePrimaryGoal;
  }

  const assistantTasks = stringArray(assistantProfile?.enabledTasks).filter((entry) => ENABLED_TASK_KEYS.has(entry));
  const taskPrimaryGoal = normalizePrimaryGoalFromTasks(assistantTasks.length > 0 ? assistantTasks : enabledTasks);
  if (taskPrimaryGoal) {
    return taskPrimaryGoal;
  }

  const rawSetupGoal = firstString(setupGoal);
  const mappedSetupGoals: Record<string, PrimaryGoal> = {
    lead_capture: "lead_generation",
    support: "support_automation",
    product_advice: "product_questions",
    appointments: "appointment_requests",
  };

  return mappedSetupGoals[rawSetupGoal] || DEFAULT_PRIMARY_GOAL;
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeTone(value: unknown): SiteDetails["tone"] {
  const raw = firstString(value);
  if (raw === "friendly" || raw === "professional" || raw === "consultative" || raw === "premium" || raw === "direct") {
    return raw as SiteDetails["tone"];
  }
  if (raw === "formal") {
    return "professional";
  }
  if (raw === "warm") {
    return "friendly";
  }
  if (raw === "neutral") {
    return "direct";
  }
  return DEFAULT_TONE;
}

export function normalizeSite(data: Record<string, unknown>): SiteDetails {
  const allowedDomains = Array.isArray(data.allowedDomains)
    ? data.allowedDomains.filter((entry): entry is string => typeof entry === "string")
    : [];
  const assistantProfile =
    data.assistantProfile && typeof data.assistantProfile === "object" && !Array.isArray(data.assistantProfile)
      ? (data.assistantProfile as Record<string, unknown>)
      : null;
  const conversationFlow =
    data.conversationFlow && typeof data.conversationFlow === "object" && !Array.isArray(data.conversationFlow)
      ? (data.conversationFlow as Record<string, unknown>)
      : {};
  const assistantRequiredFields = assistantProfile?.requiredFields;
  const assistantEnabledTasks = assistantProfile?.enabledTasks;
  const primaryGoal = normalizePrimaryGoal(data.primaryGoal, data.setupGoal, assistantProfile, data.enabledTasks);
  const effectiveConversationFlow =
    assistantRequiredFields !== undefined
      ? {
          ...conversationFlow,
          requiredFields: assistantRequiredFields,
        }
      : conversationFlow;

  return {
    id: firstString(data.id),
    name: firstString(data.name),
    siteKey: firstString(data.siteKey),
    allowedDomains,
    companyName: firstString(data.companyName, firstString(data.name)),
    websiteUrl: firstString(data.websiteUrl, firstString(data.domain, allowedDomains[0] || "")),
    supportEmail: firstString(data.supportEmail),
    phone: firstString(data.phone),
    language: firstString(data.language, "de") === "en" ? "en" : "de",
    botName: firstString(data.botName, "Service-Assistent"),
    logoUrl: firstString(data.logoUrl),
    brandColor: firstString(data.brandColor, "#b55400"),
    accentColor: firstString(data.accentColor, "#fff0d9"),
    welcomeMessage: firstString(data.welcomeMessage, "Hi! Wie kann ich helfen?"),
    placeholderText: firstString(data.placeholderText, "Nachricht schreiben..."),
    widgetPosition: firstString(data.widgetPosition) === "bottom_left" ? "bottom_left" : "bottom_right",
    launcherLabel: firstString(data.launcherLabel, "Chat"),
    privacyUrl: firstString(data.privacyUrl),
    privacyNoticeText: firstString(data.privacyNoticeText),
    fontFamily: firstString(data.fontFamily, "system"),
    systemPrompt: firstString(data.systemPrompt),
    industry: firstString(data.industry),
    botType: firstString(data.botType, DEFAULT_BOT_TYPE),
    setupGoal: firstString(data.setupGoal),
    primaryGoal,
    tone: normalizeTone(assistantProfile?.tone || data.tone),
    knowledgeMode: ["flexible", "grounded", "strict"].includes(firstString(assistantProfile?.knowledgeMode || data.knowledgeMode))
      ? ((assistantProfile?.knowledgeMode || data.knowledgeMode) as KnowledgeMode)
      : "flexible",
    fallbackBehavior: ["ask_followup", "collect_contact", "handoff"].includes(firstString(data.fallbackBehavior))
      ? (data.fallbackBehavior as FallbackBehavior)
      : "ask_followup",
    conversationFlow: effectiveConversationFlow,
    enabledTasks: normalizeEnabledTasks(assistantEnabledTasks || data.enabledTasks),
    assistantProfile,
    ctaText: firstString(data.ctaText),
    leadCaptureEnabled: data.leadCaptureEnabled !== false,
    leadNotificationEmail: firstString(data.leadNotificationEmail),
    consentRequired: data.consentRequired !== false,
    templateId: firstString(data.templateId),
    templateVersion: typeof data.templateVersion === "number" ? data.templateVersion : null,
    templateAppliedAt: firstString(data.templateAppliedAt),
    lastTestedAt: firstString(data.lastTestedAt),
    lastTestQuestion: firstString(data.lastTestQuestion),
    lastTestAnswer: firstString(data.lastTestAnswer),
    goLiveAt: firstString(data.goLiveAt),
  };
}

export function mapStepStatusToTone(status: CustomerStatusStep["status"] | undefined): CustomerStatusTone {
  if (status === "complete") {
    return "done";
  }
  if (status === "warning" || status === "blocked") {
    return "attention";
  }
  return "pending";
}

export function statusForWizardStep(status: CustomerApiStatus | null, step: WizardStepKey): CustomerStatusTone {
  const keys = STATUS_STEP_GROUPS[step];
  const related = status?.steps?.filter((entry) => keys.includes(entry.key)) || [];
  if (related.length === 0) {
    return "pending";
  }
  if (related.some((entry) => entry.status === "blocked" || entry.status === "warning")) {
    return "attention";
  }
  if (related.every((entry) => entry.status === "complete")) {
    return "done";
  }
  return "pending";
}

export function wizardStepStatusLabel(status: CustomerApiStatus | null, step: WizardStepKey) {
  const keys = STATUS_STEP_GROUPS[step];
  const related = status?.steps?.filter((entry) => keys.includes(entry.key)) || [];

  if (related.some((entry) => entry.status === "blocked")) {
    return "Blockiert";
  }
  if (related.some((entry) => entry.status === "warning")) {
    return "Unvollständig";
  }
  if (related.length > 0 && related.every((entry) => entry.status === "complete")) {
    return "Abgeschlossen";
  }
  return "Offen";
}

export function sourceTone(source: KnowledgeSource): CustomerStatusTone {
  if (!source.isActive || source.status === "disabled") {
    return "pending";
  }
  if (source.runtimeReadiness === "ready" || source.status === "ready") {
    return "done";
  }
  if (
    source.status === "failed"
    || source.ingestStatus === "blocked"
    || source.runtimeReadiness === "blocked"
  ) {
    return "attention";
  }
  return "pending";
}
