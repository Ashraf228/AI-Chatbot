"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WidgetPreview } from "../branding/WidgetPreview";
import { type IndustryTemplate, templatesByKey } from "../../lib/industry-templates";
import {
  createManualKnowledgeSource,
  deleteKnowledgeSource,
  getKnowledgeSources,
  getSite,
  importUrlKnowledgeSource,
  resyncKnowledgeSource,
  setKnowledgeSourceActive,
  setSiteGoLive,
  updateSiteBasics,
  updateSiteBranding,
  updateSiteSettings,
  uploadKnowledgePdf,
} from "../../lib/setup-wizard-api";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { getKnowledgeModeLabel, getStatusLabel } from "../../lib/labels";
import { Button } from "../shared/Button";
import { CompactMetricCard } from "../shared/CompactMetricCard";
import { EmptyStateCard } from "../shared/EmptyStateCard";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { SetupReadinessChecklist } from "../sites/SetupReadinessChecklist";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import {
  mapOverallStatusToTone,
  mapStatusSeverityToTone,
  type CustomerApiStatus,
  type CustomerOverallStatus,
  type CustomerStatusStep,
  type CustomerStatusTone,
} from "./customer-status";

type CustomerSetupWizardProps = {
  siteId: string;
};

type SiteDetails = {
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
  setupGoal: string;
  primaryGoal: PrimaryGoal | "";
  tone: Tone | "";
  knowledgeMode: KnowledgeMode;
  fallbackBehavior: FallbackBehavior;
  ctaText: string;
  templateId: string;
  templateVersion: number | null;
  templateAppliedAt: string;
  lastTestedAt: string;
  lastTestQuestion: string;
  lastTestAnswer: string;
  goLiveAt: string;
};

type KnowledgeMode = "flexible" | "grounded" | "strict";
type FallbackBehavior = "ask_followup" | "collect_contact" | "handoff";
type PrimaryGoal =
  | "support_automation"
  | "lead_generation"
  | "customer_advice"
  | "product_questions"
  | "appointment_requests"
  | "internal_knowledge";
type Tone = "professional" | "friendly" | "premium" | "direct" | "consultative";

type KnowledgeSource = {
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

type WizardStepKey = "profile" | "goal" | "knowledge" | "design" | "launch";
type KnowledgeMethod = "manual" | "url" | "pdf";

type TestChatMessage = {
  role: "user" | "assistant";
  text: string;
  sources?: Array<{ title?: string; url?: string; score?: number }>;
};

const WIZARD_STEPS: Array<{ key: WizardStepKey; label: string; description: string }> = [
  { key: "profile", label: "Grundlagen", description: "Firma, Website und Domain" },
  { key: "goal", label: "Ziel & Verhalten", description: "Branche, Aufgabe und Ton" },
  { key: "knowledge", label: "Wissen", description: "Text, Website oder PDF" },
  { key: "design", label: "Design", description: "Branding und Widget-Vorschau" },
  { key: "launch", label: "Test & Go-Live", description: "Prüfen, einbinden, live schalten" },
];

const GOAL_OPTIONS: Array<{ value: PrimaryGoal | ""; label: string; help: string }> = [
  { value: "", label: "Bitte wählen", help: "Noch kein Ziel gewählt." },
  { value: "support_automation", label: "Support automatisieren", help: "Häufige Kundenfragen zuverlässig beantworten." },
  { value: "lead_generation", label: "Anfragen gewinnen", help: "Interessenten erkennen und Kontaktdaten erfassen." },
  { value: "customer_advice", label: "Kunden beraten", help: "Besucher durch Beratungsgespräche führen." },
  { value: "product_questions", label: "Produktfragen beantworten", help: "Sortiment, Leistungen oder Produkte erklären." },
  { value: "appointment_requests", label: "Termine vorbereiten", help: "Kontakt- oder Terminwünsche qualifizieren." },
  { value: "internal_knowledge", label: "Internes Wissen nutzbar machen", help: "Wissen strukturiert und kontrolliert abrufen." },
];

const TONE_OPTIONS: Array<{ value: Tone | ""; label: string }> = [
  { value: "", label: "Bitte wählen" },
  { value: "professional", label: "Professionell" },
  { value: "friendly", label: "Freundlich" },
  { value: "premium", label: "Premium" },
  { value: "direct", label: "Direkt" },
  { value: "consultative", label: "Beratend" },
];

const KNOWLEDGE_MODE_OPTIONS: Array<{ value: KnowledgeMode; label: string; help: string }> = [
  { value: "flexible", label: "Flexibel", help: "Antwortet allgemein und nutzt Wissen, wenn es passt." },
  { value: "grounded", label: "Quellenbasiert", help: "Antwortet primär aus hinterlegtem Unternehmenswissen." },
  { value: "strict", label: "Strikt", help: "Antwortet nur, wenn passende Wissensquellen gefunden werden." },
];

const FALLBACK_OPTIONS: Array<{ value: FallbackBehavior; label: string }> = [
  { value: "ask_followup", label: "Rückfrage stellen" },
  { value: "collect_contact", label: "Kontakt aufnehmen lassen" },
  { value: "handoff", label: "An Menschen übergeben" },
];

const STATUS_STEP_GROUPS: Record<WizardStepKey, string[]> = {
  profile: ["basics", "template"],
  goal: ["behavior"],
  knowledge: ["knowledge"],
  design: ["design"],
  launch: ["embed", "test", "live"],
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

function normalizeDomains(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function domainFromUrl(value: string) {
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

function createEmbedCode(loaderUrl: string, siteKey: string) {
  return `<script src="${loaderUrl}" data-site-key="${siteKey}" async></script>`;
}

function firstString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeSite(data: Record<string, unknown>): SiteDetails {
  const allowedDomains = Array.isArray(data.allowedDomains)
    ? data.allowedDomains.filter((entry): entry is string => typeof entry === "string")
    : [];
  const primaryGoal = firstString(data.primaryGoal, firstString(data.setupGoal)) as SiteDetails["primaryGoal"];

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
    templateId: firstString(data.templateId),
    templateVersion: typeof data.templateVersion === "number" ? data.templateVersion : null,
    templateAppliedAt: firstString(data.templateAppliedAt),
    lastTestedAt: firstString(data.lastTestedAt),
    lastTestQuestion: firstString(data.lastTestQuestion),
    lastTestAnswer: firstString(data.lastTestAnswer),
    goLiveAt: firstString(data.goLiveAt),
  };
}

function mapStepStatusToTone(status: CustomerStatusStep["status"] | undefined): CustomerStatusTone {
  if (status === "complete") {
    return "done";
  }
  if (status === "warning" || status === "blocked") {
    return "attention";
  }
  return "pending";
}

function statusForWizardStep(status: CustomerApiStatus | null, step: WizardStepKey): CustomerStatusTone {
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

function statusLabel(source: KnowledgeSource) {
  if (!source.isActive || source.status === "disabled") {
    return getStatusLabel("disabled");
  }
  return getStatusLabel(source.status || "pending");
}

function sourceTone(source: KnowledgeSource): CustomerStatusTone {
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

export function CustomerSetupWizard({ siteId }: CustomerSetupWizardProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [overallStatus, setOverallStatus] = useState<CustomerOverallStatus | string>("Setup unvollständig");
  const [serverStatus, setServerStatus] = useState<CustomerApiStatus | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [profileForm, setProfileForm] = useState({
    companyName: "",
    industry: "",
    websiteUrl: "",
    allowedDomains: "",
    supportEmail: "",
    phone: "",
    language: "de" as "de" | "en",
  });
  const [goalForm, setGoalForm] = useState({
    primaryGoal: "" as SiteDetails["primaryGoal"],
    tone: "" as SiteDetails["tone"],
    knowledgeMode: "flexible" as KnowledgeMode,
    fallbackBehavior: "ask_followup" as FallbackBehavior,
    ctaText: "",
    systemPrompt: "",
  });
  const [knowledgeForm, setKnowledgeForm] = useState({
    title: "FAQ",
    question: "",
    content: "",
    url: "",
    urlTitle: "",
  });
  const [knowledgeMethod, setKnowledgeMethod] = useState<KnowledgeMethod>("manual");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [designForm, setDesignForm] = useState({
    brandColor: "#b55400",
    accentColor: "#fff0d9",
    logoUrl: "",
    welcomeMessage: "",
    placeholderText: "Nachricht schreiben...",
    widgetPosition: "bottom_right" as "bottom_right" | "bottom_left",
    launcherLabel: "Chat",
    privacyUrl: "",
    privacyNoticeText: "",
  });
  const [testQuestion, setTestQuestion] = useState("");
  const [testSessionId, setTestSessionId] = useState("");
  const [testMessages, setTestMessages] = useState<TestChatMessage[]>([]);
  const testQuestionChips = useMemo(
    () =>
      [
        site?.lastTestQuestion,
        "Was bietet ihr an?",
        "Wie kann ich Kontakt aufnehmen?",
        "Was kostet das?",
      ].filter((question): question is string => Boolean(question && question.trim())),
    [site?.lastTestQuestion],
  );

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  const templateMap = useMemo(() => templatesByKey(templates), [templates]);
  const activeStep = WIZARD_STEPS[activeStepIndex];
  const selectedTemplate = site?.industry ? templateMap[site.industry] : undefined;
  const readyActiveSources = sources.filter((source) => source.isActive && source.status === "ready");
  const embedCode = site ? createEmbedCode(loaderUrl, site.siteKey) : "";
  const canGoLive = Boolean(serverStatus?.isLiveReady);
  const liveDone = serverStatus?.lifecycleStatus === "live" || Boolean(site?.goLiveAt);

  async function refreshStatus() {
    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/status`, { cache: "no-store" });
    const data = (await response.json().catch(() => ({}))) as CustomerApiStatus & { status?: string };
    if (response.ok && data?.code) {
      setOverallStatus(data.status || data.label);
      setServerStatus(data);
    }
  }

  async function refreshSources() {
    const data = await getKnowledgeSources(siteId);
    setSources(Array.isArray(data) ? (data as KnowledgeSource[]) : []);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [siteData, sourcesData, templatesResponse, statusResponse] = await Promise.all([
        getSite(siteId),
        getKnowledgeSources(siteId),
        fetch("/api/industry-templates", { cache: "no-store" }),
        fetch(`/api/sites/${encodeURIComponent(siteId)}/status`, { cache: "no-store" }),
      ]);
      const templatesData = await templatesResponse.json().catch(() => []);
      const statusData = (await statusResponse.json().catch(() => ({}))) as CustomerApiStatus & { status?: string };
      const nextSite = normalizeSite(siteData as Record<string, unknown>);

      setSite(nextSite);
      setSources(Array.isArray(sourcesData) ? (sourcesData as KnowledgeSource[]) : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      if (statusResponse.ok && statusData?.code) {
        setOverallStatus(statusData.status || statusData.label);
        setServerStatus(statusData);
      }
      setProfileForm({
        companyName: nextSite.companyName || nextSite.name,
        industry: nextSite.industry,
        websiteUrl: nextSite.websiteUrl,
        allowedDomains: nextSite.allowedDomains.join("\n"),
        supportEmail: nextSite.supportEmail,
        phone: nextSite.phone,
        language: nextSite.language,
      });
      setGoalForm({
        primaryGoal: nextSite.primaryGoal,
        tone: nextSite.tone,
        knowledgeMode: nextSite.knowledgeMode,
        fallbackBehavior: nextSite.fallbackBehavior,
        ctaText: nextSite.ctaText,
        systemPrompt: nextSite.systemPrompt,
      });
      setDesignForm({
        brandColor: nextSite.brandColor,
        accentColor: nextSite.accentColor,
        logoUrl: nextSite.logoUrl,
        welcomeMessage: nextSite.welcomeMessage,
        placeholderText: nextSite.placeholderText,
        widgetPosition: nextSite.widgetPosition,
        launcherLabel: nextSite.launcherLabel,
        privacyUrl: nextSite.privacyUrl,
        privacyNoticeText: nextSite.privacyNoticeText,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [siteId]);

  async function runAction<T>(key: string, action: () => Promise<T>, successMessage: string) {
    setSavingKey(key);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(successMessage);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion konnte nicht ausgeführt werden.");
      return null;
    } finally {
      setSavingKey(null);
    }
  }

  async function saveProfile() {
    const rawDomains = normalizeDomains(profileForm.allowedDomains);
    const websiteDomain = domainFromUrl(profileForm.websiteUrl);
    const allowedDomains = rawDomains.length > 0 ? rawDomains : websiteDomain ? [websiteDomain] : [];
    const companyName = profileForm.companyName.trim();

    const saved = await runAction(
      "profile",
      async () => {
        const [siteResult, brandingResult, configResult] = await Promise.all([
          updateSiteBasics(siteId, { name: companyName || site?.name || siteId, allowedDomains }),
          updateSiteBranding(siteId, { companyName: companyName || site?.companyName || site?.name || "" }),
          updateSiteSettings(siteId, {
            websiteUrl: profileForm.websiteUrl.trim(),
            domain: websiteDomain,
            allowedDomains,
            supportEmail: profileForm.supportEmail.trim(),
            phone: profileForm.phone.trim(),
            language: profileForm.language,
            industry: profileForm.industry,
          }),
        ]);
        return { siteResult, brandingResult, configResult };
      },
      "Unternehmensprofil gespeichert.",
    );

    if (!saved) {
      return false;
    }

    await load();
    return true;
  }

  async function applyIndustryTemplate() {
    if (!profileForm.industry) {
      setError("Bitte zuerst eine Branche auswählen.");
      return false;
    }

    const template = templateMap[profileForm.industry];
    if (!template) {
      setError("Für diese Branche ist noch keine Vorlage hinterlegt.");
      return false;
    }

    const response = await runAction(
      "template",
      async () => {
        const templateResponse = await fetch(`/api/sites/${encodeURIComponent(siteId)}/apply-template`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: template.key, mode: "fill_missing_only" }),
        });
        const data = await templateResponse.json().catch(() => ({}));
        if (!templateResponse.ok) {
          throw new Error(typeof data?.message === "string" ? data.message : "Vorlage konnte nicht angewendet werden.");
        }
        return data;
      },
      `Vorlage „${template.label}“ angewendet.`,
    );

    if (!response) {
      return false;
    }
    await load();
    return true;
  }

  async function saveGoal() {
    const saved = await runAction(
      "goal",
      () =>
        updateSiteSettings(siteId, {
          primaryGoal: goalForm.primaryGoal,
          setupGoal: goalForm.primaryGoal,
          industry: profileForm.industry,
          tone: goalForm.tone,
          knowledgeMode: goalForm.knowledgeMode,
          fallbackBehavior: goalForm.fallbackBehavior,
          ctaText: goalForm.ctaText.trim(),
          systemPrompt: goalForm.systemPrompt.trim(),
        }),
      "KI-Ziel gespeichert.",
    );
    if (!saved) {
      return false;
    }
    setSite((current) =>
      current
        ? {
            ...current,
            primaryGoal: goalForm.primaryGoal,
            setupGoal: goalForm.primaryGoal,
            tone: goalForm.tone,
            knowledgeMode: goalForm.knowledgeMode,
            fallbackBehavior: goalForm.fallbackBehavior,
            ctaText: goalForm.ctaText,
            systemPrompt: goalForm.systemPrompt,
          }
        : current,
    );
    await refreshStatus();
    return true;
  }

  async function saveDesign() {
    const saved = await runAction(
      "design",
      async () => {
        const [branding, config] = await Promise.all([
          updateSiteBranding(siteId, {
            brandColor: designForm.brandColor,
            accentColor: designForm.accentColor,
            logoUrl: designForm.logoUrl.trim(),
            welcomeMessage: designForm.welcomeMessage.trim(),
            privacyUrl: designForm.privacyUrl.trim(),
          }),
          updateSiteSettings(siteId, {
            placeholderText: designForm.placeholderText.trim(),
            widgetPosition: designForm.widgetPosition,
            launcherLabel: designForm.launcherLabel.trim(),
            privacyNoticeText: designForm.privacyNoticeText.trim(),
          }),
        ]);
        return { branding, config };
      },
      "Design gespeichert.",
    );
    if (!saved) {
      return false;
    }
    setSite((current) =>
      current
        ? {
            ...current,
            ...designForm,
          }
        : current,
    );
    await refreshStatus();
    return true;
  }

  async function addManualKnowledge() {
    if (!knowledgeForm.content.trim()) {
      setError("Bitte Inhalt für das Wissen eintragen.");
      return;
    }

    const created = await runAction(
      "manual",
      () =>
        createManualKnowledgeSource(siteId, {
          title: knowledgeForm.title.trim() || "Wissen",
          question: knowledgeForm.question.trim() || undefined,
          content: knowledgeForm.content.trim(),
        }),
      "Wissen gespeichert.",
    );
    if (created) {
      setKnowledgeForm((current) => ({ ...current, question: "", content: "" }));
      await refreshSources();
      await refreshStatus();
    }
  }

  async function addUrlKnowledge() {
    if (!knowledgeForm.url.trim()) {
      setError("Bitte Website-URL eintragen.");
      return;
    }

    const imported = await runAction(
      "url",
      () =>
        importUrlKnowledgeSource(siteId, {
          url: knowledgeForm.url.trim(),
          title: knowledgeForm.urlTitle.trim() || undefined,
        }),
      "Website-Wissen importiert.",
    );
    if (imported) {
      setKnowledgeForm((current) => ({ ...current, url: "", urlTitle: "" }));
      await refreshSources();
      await refreshStatus();
    }
  }

  async function addPdfKnowledge() {
    if (!pdfFile) {
      setError("Bitte eine PDF-Datei auswählen.");
      return;
    }

    const uploaded = await runAction("pdf", () => uploadKnowledgePdf(siteId, pdfFile), "PDF verarbeitet.");
    if (uploaded) {
      setPdfFile(null);
      await refreshSources();
      await refreshStatus();
    }
  }

  async function toggleKnowledgeSource(source: KnowledgeSource) {
    const updated = await runAction(
      `source-${source.id}`,
      () => setKnowledgeSourceActive(source.id, !source.isActive),
      source.isActive ? "Wissensquelle deaktiviert." : "Wissensquelle aktiviert.",
    );
    if (updated) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function resyncSource(source: KnowledgeSource) {
    const updated = await runAction(
      `resync-${source.id}`,
      () => resyncKnowledgeSource(source.id),
      "Wissensquelle wird aktualisiert.",
    );
    if (updated) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function removeSource(source: KnowledgeSource) {
    const confirmed = window.confirm(`Wissensquelle „${source.title || source.label || source.id}“ wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    const deleted = await runAction(
      `delete-${source.id}`,
      () => deleteKnowledgeSource(source.id),
      "Wissensquelle gelöscht.",
    );
    if (deleted) {
      await refreshSources();
      await refreshStatus();
    }
  }

  async function sendTestMessage() {
    const messageText = testQuestion.trim();
    if (!messageText) {
      setError("Bitte eine Testfrage eingeben.");
      return;
    }

    setSavingKey("test-chat");
    setError(null);
    setTestMessages((current) => [...current, { role: "user", text: messageText }]);
    setTestQuestion("");

    try {
      const response = await fetch(`/api/widget/test-chat/${encodeURIComponent(siteId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, sessionId: testSessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.message === "string" ? data.message : "Test-Chat konnte nicht antworten.");
      }
      setTestSessionId(typeof data.sessionId === "string" ? data.sessionId : testSessionId);
      const answer = typeof data.answer === "string" ? data.answer : "";
      setTestMessages((current) => [
        ...current,
        { role: "assistant", text: answer, sources: Array.isArray(data.sources) ? data.sources : [] },
      ]);
      await updateSiteSettings(siteId, {
        lastTestedAt: new Date().toISOString(),
        lastTestQuestion: messageText,
        lastTestAnswer: answer,
      });
      await load();
      setMessage("Test gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test-Chat konnte nicht ausgeführt werden.");
    } finally {
      setSavingKey(null);
    }
  }

  async function copyEmbedCode() {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Einbindungscode konnte nicht kopiert werden.");
    }
  }

  async function goLive() {
    const result = await runAction("live", () => setSiteGoLive(siteId), "Kunde live geschaltet.");
    if (result) {
      await load();
    }
  }

  async function saveCurrentStep() {
    switch (activeStep.key) {
      case "profile":
        return saveProfile();
      case "goal":
        return saveGoal();
      case "design":
        return saveDesign();
      default:
        await refreshStatus();
        return true;
    }
  }

  async function nextStep() {
    const saved = await saveCurrentStep();
    if (saved) {
      setActiveStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
    }
  }

  function jumpToStatusStep(stepKey?: string) {
    const index = WIZARD_STEPS.findIndex((step) => STATUS_STEP_GROUPS[step.key].includes(stepKey || ""));
    if (index >= 0) {
      setActiveStepIndex(index);
    }
  }

  function renderStep() {
    if (!site) {
      return null;
    }

    switch (activeStep.key) {
      case "profile":
        return (
          <section className="dashboard-card dashboard-stack" id="setup-step-basics">
            <StepIntro
              title="Basisdaten festlegen"
              description="Lege die wichtigsten Angaben für diesen Kunden fest."
              status={statusForWizardStep(serverStatus, "profile")}
            />
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Unternehmensname *</span>
                <Input
                  value={profileForm.companyName}
                  onChange={(event) => setProfileForm((current) => ({ ...current, companyName: event.target.value }))}
                  placeholder="Muster GmbH"
                />
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Website *</span>
                <Input
                  value={profileForm.websiteUrl}
                  onChange={(event) => setProfileForm((current) => ({ ...current, websiteUrl: event.target.value }))}
                  placeholder="https://www.kunde.de"
                />
              </label>
            </div>
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Sprache</span>
                <Select
                  value={profileForm.language}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      language: event.target.value === "en" ? "en" : "de",
                    }))
                  }
                >
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </Select>
              </label>
            </div>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Erlaubte Domains *</span>
              <textarea
                className="dashboard-textarea"
                rows={3}
                value={profileForm.allowedDomains}
                onChange={(event) => setProfileForm((current) => ({ ...current, allowedDomains: event.target.value }))}
                placeholder="kunde.de&#10;www.kunde.de"
              />
            </label>
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Support-E-Mail optional</span>
                <Input
                  type="email"
                  value={profileForm.supportEmail}
                  onChange={(event) => setProfileForm((current) => ({ ...current, supportEmail: event.target.value }))}
                  placeholder="support@kunde.de"
                />
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Telefon optional</span>
                <Input
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+49 ..."
                />
              </label>
            </div>
          </section>
        );

      case "goal":
        return (
          <section className="dashboard-card dashboard-stack" id="setup-step-goal">
            <StepIntro
              title="Ziel und Verhalten festlegen"
              description="Wähle Branche, Aufgabe und Gesprächsverhalten der KI."
              status={statusForWizardStep(serverStatus, "goal")}
            />
            <section className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <div className="dashboard-grid dashboard-grid--two">
                <label className="dashboard-field">
                  <span className="dashboard-field-label">Branche *</span>
                  <Select
                    value={profileForm.industry}
                    onChange={(event) => setProfileForm((current) => ({ ...current, industry: event.target.value }))}
                  >
                    <option value="">Bitte wählen</option>
                    {templates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <div>
                  <strong>{selectedTemplate?.label || "Noch keine Vorlage ausgewählt"}</strong>
                  <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 10 }}>
                    {site.templateId
                      ? `Angewendet: ${site.templateId} v${site.templateVersion || "?"}, ${formatDate(site.templateAppliedAt)}`
                      : "Vorlagen setzen Ziel, Tonalität, CTA und typische Fragen."}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={applyIndustryTemplate}
                    disabled={savingKey === "template" || !profileForm.industry}
                  >
                    {savingKey === "template" ? "Wendet an..." : "Vorlage anwenden"}
                  </Button>
                </div>
              </div>
            </section>
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Hauptziel *</span>
                <Select
                  value={goalForm.primaryGoal}
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      primaryGoal: event.target.value as SiteDetails["primaryGoal"],
                    }))
                  }
                >
                  {GOAL_OPTIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Tonalität *</span>
                <Select
                  value={goalForm.tone}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, tone: event.target.value as SiteDetails["tone"] }))
                  }
                >
                  {TONE_OPTIONS.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Wissensmodus</span>
                <Select
                  value={goalForm.knowledgeMode}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, knowledgeMode: event.target.value as KnowledgeMode }))
                  }
                >
                  {KNOWLEDGE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Wenn die KI unsicher ist</span>
                <Select
                  value={goalForm.fallbackBehavior}
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      fallbackBehavior: event.target.value as FallbackBehavior,
                    }))
                  }
                >
                  {FALLBACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <label className="dashboard-field">
              <span className="dashboard-field-label">CTA / nächster Schritt</span>
              <Input
                value={goalForm.ctaText}
                onChange={(event) => setGoalForm((current) => ({ ...current, ctaText: event.target.value }))}
                placeholder="Kontakt aufnehmen, Termin vereinbaren, Anfrage aufnehmen"
              />
            </label>
            <div className="dashboard-grid dashboard-grid--two">
              {GOAL_OPTIONS.filter((option) => option.value === goalForm.primaryGoal).map((option) => (
                <div key={option.value || "empty"} className="dashboard-card dashboard-card--soft">
                  <strong>Auswirkung</strong>
                  <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                    {option.help}
                  </p>
                </div>
              ))}
              {KNOWLEDGE_MODE_OPTIONS.filter((option) => option.value === goalForm.knowledgeMode).map((option) => (
                <div key={option.value} className="dashboard-card dashboard-card--soft">
                  <strong>Wissensmodus</strong>
                  <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                    {option.help}
                  </p>
                </div>
              ))}
            </div>
            <details className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>Erweiterte Gesprächsanweisung</summary>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Systemhinweis</span>
                <textarea
                  className="dashboard-textarea"
                  rows={4}
                  value={goalForm.systemPrompt}
                  onChange={(event) => setGoalForm((current) => ({ ...current, systemPrompt: event.target.value }))}
                  placeholder="Beispiel: Stelle maximal eine Rückfrage, bleibe professionell und leite bei konkretem Interesse zur Kontaktaufnahme."
                />
              </label>
            </details>
          </section>
        );

      case "knowledge":
        return (
          <section className="dashboard-card dashboard-stack" id="setup-step-knowledge">
            <StepIntro
              title="Wissen hinzufügen"
              description="Diese Informationen nutzt die KI für zuverlässige Antworten."
              status={statusForWizardStep(serverStatus, "knowledge")}
            />
            <div className="dashboard-grid dashboard-grid--metrics-3">
              <CompactMetricCard label="Quellen gesamt" value={sources.length} />
              <CompactMetricCard label="Aktiv & bereit" value={readyActiveSources.length} />
              <CompactMetricCard label="Wissensmodus" value={getKnowledgeModeLabel(goalForm.knowledgeMode)} />
            </div>
            <div className="wizard-method-grid">
              {[
                { key: "manual" as KnowledgeMethod, title: "Text / FAQ hinzufügen", text: "Kurze Antworten oder FAQ direkt einfügen." },
                { key: "url" as KnowledgeMethod, title: "Website-URL importieren", text: "Eine einzelne Seite als Wissensquelle übernehmen." },
                { key: "pdf" as KnowledgeMethod, title: "PDF hochladen", text: "Ein PDF als Wissensquelle verarbeiten." },
              ].map((method) => (
                <button
                  key={method.key}
                  type="button"
                  className={`wizard-method-card${knowledgeMethod === method.key ? " wizard-method-card--active" : ""}`}
                  onClick={() => setKnowledgeMethod(method.key)}
                >
                  <strong>{method.title}</strong>
                  <span>{method.text}</span>
                </button>
              ))}
            </div>
            <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              {knowledgeMethod === "manual" ? (
                <>
                  <h3 className="dashboard-card-title dashboard-card-title--sm">Text / FAQ</h3>
                  <Input
                    value={knowledgeForm.title}
                    onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Titel"
                  />
                  <Input
                    value={knowledgeForm.question}
                    onChange={(event) => setKnowledgeForm((current) => ({ ...current, question: event.target.value }))}
                    placeholder="Frage optional"
                  />
                  <textarea
                    className="dashboard-textarea wizard-textarea-compact"
                    value={knowledgeForm.content}
                    onChange={(event) => setKnowledgeForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Antwort, FAQ oder Wissenstext einfügen"
                  />
                  <Button type="button" onClick={addManualKnowledge} disabled={savingKey === "manual"}>
                    {savingKey === "manual" ? "Speichert..." : "Text speichern"}
                  </Button>
                </>
              ) : null}

              {knowledgeMethod === "url" ? (
                <>
                  <h3 className="dashboard-card-title dashboard-card-title--sm">Website-URL</h3>
                  <Input
                    value={knowledgeForm.url}
                    onChange={(event) => setKnowledgeForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://www.kunde.de/faq"
                  />
                  <Input
                    value={knowledgeForm.urlTitle}
                    onChange={(event) => setKnowledgeForm((current) => ({ ...current, urlTitle: event.target.value }))}
                    placeholder="Titel optional"
                  />
                  <Button type="button" onClick={addUrlKnowledge} disabled={savingKey === "url"}>
                    {savingKey === "url" ? "Importiert..." : "Website importieren"}
                  </Button>
                </>
              ) : null}

              {knowledgeMethod === "pdf" ? (
                <>
                  <h3 className="dashboard-card-title dashboard-card-title--sm">PDF</h3>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="dashboard-control"
                    onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="secondary" onClick={addPdfKnowledge} disabled={savingKey === "pdf"}>
                    {savingKey === "pdf" ? "Lädt hoch..." : "PDF hochladen"}
                  </Button>
                </>
              ) : null}
            </div>
            <div className="dashboard-stack dashboard-stack--sm">
              <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Wissensquellen</h3>
                <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
                  Wissensbereich öffnen
                </Link>
              </div>
              {sources.length === 0 ? (
                <EmptyStateCard title="Noch kein Wissen hinterlegt" description="Starte mit FAQ oder Website-URL." />
              ) : (
                <div className="wizard-source-list">
                  {sources.map((source) => (
                    <div key={source.id} className="wizard-source-row">
                      <div>
                        <strong>{source.title || source.label || "Wissensquelle"}</strong>
                        <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                          {source.type.toUpperCase()} · {source.url || source.sourceUrl || "Manueller Inhalt"}
                        </p>
                      </div>
                      <CustomerStatusBadge status={sourceTone(source)} label={statusLabel(source)} />
                      <div className="dashboard-inline dashboard-wrap">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => toggleKnowledgeSource(source)}
                          disabled={savingKey === `source-${source.id}`}
                        >
                          {source.isActive ? "Deaktivieren" : "Aktivieren"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => resyncSource(source)}
                          disabled={savingKey === `resync-${source.id}`}
                        >
                          Neu synchronisieren
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removeSource(source)}
                          disabled={savingKey === `delete-${source.id}`}
                        >
                          Löschen
                        </Button>
                      </div>
                      {source.errorMessage ? <p className="dashboard-status dashboard-status--error">{source.errorMessage}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );

      case "design":
        return (
          <section className="dashboard-card dashboard-stack" id="setup-step-design">
            <StepIntro
              title="Widget gestalten"
              description="Stelle Begrüßung, Farben und Position ein."
              status={statusForWizardStep(serverStatus, "design")}
            />
            <div className="dashboard-grid dashboard-grid--form-preview">
              <div className="dashboard-stack">
                <label className="dashboard-field">
                  <span className="dashboard-field-label">Begrüßung *</span>
                  <textarea
                    className="dashboard-textarea"
                    rows={3}
                    value={designForm.welcomeMessage}
                    onChange={(event) =>
                      setDesignForm((current) => ({ ...current, welcomeMessage: event.target.value }))
                    }
                  />
                </label>
                <div className="dashboard-grid dashboard-grid--two">
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Eingabe-Platzhalter</span>
                    <Input
                      value={designForm.placeholderText}
                      onChange={(event) =>
                        setDesignForm((current) => ({ ...current, placeholderText: event.target.value }))
                      }
                    />
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Button-Text</span>
                    <Input
                      value={designForm.launcherLabel}
                      onChange={(event) => setDesignForm((current) => ({ ...current, launcherLabel: event.target.value }))}
                    />
                  </label>
                </div>
                <div className="dashboard-grid dashboard-grid--two">
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Primärfarbe</span>
                    <Input
                      type="color"
                      value={designForm.brandColor}
                      onChange={(event) => setDesignForm((current) => ({ ...current, brandColor: event.target.value }))}
                    />
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Position</span>
                    <Select
                      value={designForm.widgetPosition}
                      onChange={(event) =>
                        setDesignForm((current) => ({
                          ...current,
                          widgetPosition: event.target.value === "bottom_left" ? "bottom_left" : "bottom_right",
                        }))
                      }
                    >
                      <option value="bottom_right">Unten rechts</option>
                      <option value="bottom_left">Unten links</option>
                    </Select>
                  </label>
                </div>
                <details className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>Erweiterte Designfelder</summary>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Logo URL optional</span>
                    <Input
                      value={designForm.logoUrl}
                      onChange={(event) => setDesignForm((current) => ({ ...current, logoUrl: event.target.value }))}
                      placeholder="https://..."
                    />
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Datenschutz-URL</span>
                    <Input
                      value={designForm.privacyUrl}
                      onChange={(event) => setDesignForm((current) => ({ ...current, privacyUrl: event.target.value }))}
                      placeholder="https://www.kunde.de/datenschutz"
                    />
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Akzentfarbe</span>
                    <Input
                      type="color"
                      value={designForm.accentColor}
                      onChange={(event) => setDesignForm((current) => ({ ...current, accentColor: event.target.value }))}
                    />
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Datenschutz-Hinweis optional</span>
                    <textarea
                      className="dashboard-textarea"
                      rows={3}
                      value={designForm.privacyNoticeText}
                      onChange={(event) =>
                        setDesignForm((current) => ({ ...current, privacyNoticeText: event.target.value }))
                      }
                      placeholder="Kurzer Hinweis zur Verarbeitung von Chatdaten."
                    />
                  </label>
                </details>
                <Button type="button" onClick={saveDesign} disabled={savingKey === "design"}>
                  {savingKey === "design" ? "Speichert..." : "Design speichern"}
                </Button>
              </div>
              <WidgetPreview
                companyName={profileForm.companyName || site.companyName || site.name}
                botName={site.botName}
                logoUrl={designForm.logoUrl}
                brandColor={designForm.brandColor}
                accentColor={designForm.accentColor}
                fontFamily={site.fontFamily}
                welcomeMessage={designForm.welcomeMessage}
                placeholderText={designForm.placeholderText}
                launcherLabel={designForm.launcherLabel}
                privacyUrl={designForm.privacyUrl}
              />
            </div>
          </section>
        );

      case "launch":
        return (
          <section className="dashboard-card dashboard-stack" id="setup-step-live">
            <StepIntro
              title="Abschluss prüfen"
              description="Teste den Chat, kopiere den Einbindungscode und schalte nur live, wenn alles bereit ist."
              status={statusForWizardStep(serverStatus, "launch")}
            />
            <div className="dashboard-grid dashboard-grid--two">
              <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Test-Chat</h3>
                <div className="dashboard-inline dashboard-wrap">
                  {testQuestionChips.slice(0, 3).map((question) => (
                    <Button key={question} type="button" variant="secondary" onClick={() => setTestQuestion(question)}>
                      {question}
                    </Button>
                  ))}
                </div>
                <div className="dashboard-stack dashboard-stack--sm">
                  {testMessages.length === 0 ? (
                    <p className="dashboard-copy dashboard-copy--muted">Stelle eine typische Kundenfrage, bevor du live schaltest.</p>
                  ) : (
                    testMessages.map((entry, index) => (
                      <div key={`${entry.role}-${index}`} className="dashboard-card">
                        <strong>{entry.role === "user" ? "Testfrage" : "Antwort"}</strong>
                        <p className="dashboard-copy" style={{ marginBottom: 0 }}>
                          {entry.text}
                        </p>
                        {entry.sources?.length ? (
                          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0, marginTop: 6 }}>
                            Quellen: {entry.sources.map((source) => source.title || source.url || "Quelle").join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
                <textarea
                  className="dashboard-textarea"
                  rows={2}
                  value={testQuestion}
                  onChange={(event) => setTestQuestion(event.target.value)}
                  placeholder="Testfrage eingeben"
                />
                <Button type="button" onClick={sendTestMessage} disabled={savingKey === "test-chat"}>
                  {savingKey === "test-chat" ? "Test läuft..." : "Testfrage senden"}
                </Button>
                <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                  Letzter Test: {formatDate(site.lastTestedAt)}
                </p>
              </div>
              <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Einbindung</h3>
                <div className="dashboard-info-row">
                  <strong>Einbindungscode</strong>
                  <span className="dashboard-breakword dashboard-mono">{site.siteKey}</span>
                </div>
                <textarea className="dashboard-textarea dashboard-mono" readOnly value={embedCode} rows={5} />
                <Button type="button" onClick={copyEmbedCode}>
                  Einbindungscode kopieren
                </Button>
                {copied ? <p className="dashboard-status dashboard-status--success">Einbindungscode kopiert.</p> : null}
                <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                  Erlaubte Domains: {site.allowedDomains.length ? site.allowedDomains.join(", ") : "Noch nicht gesetzt"}
                </p>
              </div>
            </div>
            <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <div className="dashboard-info-row">
                <div>
                  <strong>Live-Checkliste</strong>
                  <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                    Der Backend-Status entscheidet, ob Go-Live möglich ist.
                  </p>
                </div>
                <CustomerStatusBadge
                  status={serverStatus ? mapStatusSeverityToTone(serverStatus.severity) : mapOverallStatusToTone(overallStatus)}
                  label={serverStatus?.label || overallStatus}
                />
              </div>
              <div className="dashboard-grid dashboard-grid--two">
                {(serverStatus?.steps || []).map((step) => (
                  <button
                    key={step.key}
                    type="button"
                    className="dashboard-link-card"
                    onClick={() => jumpToStatusStep(step.key)}
                  >
                    <span>{step.label}</span>
                    <CustomerStatusBadge status={mapStepStatusToTone(step.status)} />
                  </button>
                ))}
              </div>
              {serverStatus?.missingSteps?.length ? (
                <p className="dashboard-status dashboard-status--error">
                  Noch nicht bereit:{" "}
                  {serverStatus.missingSteps
                    .map((key) => serverStatus.steps.find((step) => step.key === key)?.label || key)
                    .join(", ")}
                </p>
              ) : null}
              <Button type="button" onClick={goLive} disabled={!canGoLive || liveDone || savingKey === "live"}>
                {savingKey === "live" ? "Schaltet live..." : liveDone ? "Bereits live" : "Kunde live schalten"}
              </Button>
              {liveDone ? (
                <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                  Nächster Schritt: Widget auf der Kundenwebsite einbauen und erste echte Chats prüfen.
                </p>
              ) : null}
            </div>
          </section>
        );
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (!site) {
    return <ErrorState message={error || "Kundendaten konnten nicht geladen werden."} />;
  }

  return (
    <div className="setup-wizard-shell">
      <main className="setup-wizard-main dashboard-stack">
        <section className="dashboard-card dashboard-card--compact dashboard-stack">
          <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
            <div>
              <h2 className="dashboard-card-title">Setup Wizard</h2>
              <p className="dashboard-copy dashboard-copy--muted">Führe den Kunden in fünf klaren Schritten bis zum Go-Live.</p>
            </div>
            <CustomerStatusBadge
              status={serverStatus ? mapStatusSeverityToTone(serverStatus.severity) : mapOverallStatusToTone(overallStatus)}
              label={serverStatus?.label || overallStatus}
            />
          </div>

          <div className="dashboard-setup-steps dashboard-setup-steps--compact">
            {WIZARD_STEPS.map((step, index) => {
              const isActive = index === activeStepIndex;
              return (
                <button
                  key={step.key}
                  type="button"
                  className={`dashboard-setup-step${isActive ? " dashboard-setup-step--active" : ""}`}
                  onClick={() => setActiveStepIndex(index)}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="dashboard-setup-step__number">{index + 1}</span>
                  <span>
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </span>
                  <CustomerStatusBadge status={statusForWizardStep(serverStatus, step.key)} />
                </button>
              );
            })}
          </div>
        </section>

        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
        {error ? <ErrorState message={error} /> : null}

        {renderStep()}

        <section className="dashboard-card dashboard-card--compact dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setActiveStepIndex((current) => Math.max(current - 1, 0))}
            disabled={activeStepIndex === 0 || Boolean(savingKey)}
          >
            Zurück
          </Button>
          <div className="dashboard-inline dashboard-wrap">
            <Button type="button" variant="secondary" onClick={saveCurrentStep} disabled={Boolean(savingKey)}>
              {savingKey ? "Speichert..." : "Speichern"}
            </Button>
            {activeStep.key !== "launch" ? (
              <Button type="button" variant="secondary" onClick={() => setActiveStepIndex((current) => current + 1)}>
                Überspringen
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={activeStep.key === "launch" ? goLive : nextStep}
              disabled={Boolean(savingKey) || (activeStep.key === "launch" && (!canGoLive || liveDone))}
            >
              {activeStep.key === "launch" ? "Live schalten" : "Weiter"}
            </Button>
          </div>
        </section>
      </main>

      <aside className="setup-wizard-side dashboard-stack">
        <section className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
          <strong>
            Schritt {activeStepIndex + 1} von {WIZARD_STEPS.length}
          </strong>
          <CompactMetricCard label="Live-Bereitschaft" value={`${serverStatus?.progress ?? 0}%`} />
          {serverStatus?.nextAction ? (
            <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <strong>Nächster Schritt</strong>
              {serverStatus.nextAction.href ? (
                <Link href={serverStatus.nextAction.href} className="dashboard-link-card">
                  {serverStatus.nextAction.label}
                </Link>
              ) : (
                <button type="button" className="dashboard-link-card" onClick={() => jumpToStatusStep(serverStatus.nextAction?.key)}>
                  {serverStatus.nextAction.label}
                </button>
              )}
            </div>
          ) : (
            <p className="dashboard-status dashboard-status--success">Bereit für Go-Live</p>
          )}
          {!canGoLive && !liveDone ? (
            <p className="dashboard-copy dashboard-copy--muted">Noch nicht bereit: {serverStatus?.label || "Setup prüfen"}.</p>
          ) : null}
        </section>
        <SetupReadinessChecklist siteId={siteId} status={serverStatus} />
      </aside>
    </div>
  );
}

function StepIntro({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: CustomerStatusTone;
}) {
  return (
    <div className="dashboard-info-row">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">{title}</h3>
        <p className="dashboard-copy dashboard-copy--muted">{description}</p>
      </div>
      <CustomerStatusBadge status={status} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-copy--muted">{label}</p>
    </div>
  );
}
