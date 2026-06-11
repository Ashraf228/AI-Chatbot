import type { CustomerApiStatus, CustomerStatusStep, CustomerStatusTone } from "../customer-status";
import { PRIMARY_GOAL_VALUES, STATUS_STEP_GROUPS } from "./setupWizardConstants";
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

export function normalizePrimaryGoal(primaryGoal: unknown, setupGoal: unknown): PrimaryGoal | "" {
  const rawPrimaryGoal = firstString(primaryGoal);
  if (PRIMARY_GOAL_VALUES.has(rawPrimaryGoal)) {
    return rawPrimaryGoal as PrimaryGoal;
  }

  const rawSetupGoal = firstString(setupGoal);
  const mappedSetupGoals: Record<string, PrimaryGoal> = {
    lead_capture: "lead_generation",
    support: "support_automation",
    product_advice: "product_questions",
    appointments: "appointment_requests",
  };

  return mappedSetupGoals[rawSetupGoal] || "";
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeSite(data: Record<string, unknown>): SiteDetails {
  const allowedDomains = Array.isArray(data.allowedDomains)
    ? data.allowedDomains.filter((entry): entry is string => typeof entry === "string")
    : [];
  const primaryGoal = normalizePrimaryGoal(data.primaryGoal, data.setupGoal);

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
    botType: firstString(data.botType, "handwerker-first-contact"),
    setupGoal: firstString(data.setupGoal),
    primaryGoal,
    tone: firstString(data.tone) as SiteDetails["tone"],
    knowledgeMode: ["flexible", "grounded", "strict"].includes(firstString(data.knowledgeMode))
      ? (data.knowledgeMode as KnowledgeMode)
      : "flexible",
    fallbackBehavior: ["ask_followup", "collect_contact", "handoff"].includes(firstString(data.fallbackBehavior))
      ? (data.fallbackBehavior as FallbackBehavior)
      : "ask_followup",
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
    return "Fehler";
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
  if (source.status === "ready") {
    return "done";
  }
  if (source.status === "failed") {
    return "attention";
  }
  return "pending";
}
