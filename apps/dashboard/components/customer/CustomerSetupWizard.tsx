"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { type IndustryTemplate, templatesByKey } from "../../lib/industry-templates";
import { encodeSiteId } from "../../lib/site-id";
import { resolveWidgetLoaderUrl } from "../../lib/widget-loader-url";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import {
  mapOverallStatusToTone,
  mapStatusSeverityToTone,
  type CustomerApiStatus,
  type CustomerOverallStatus,
  type CustomerStatusStep,
  type CustomerStatusStepKey,
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
  botName: string;
  logoUrl: string;
  brandColor: string;
  welcomeMessage: string;
  systemPrompt: string;
  privacyUrl: string;
  industry: string;
  setupGoal: "" | "lead_capture" | "support" | "product_advice" | "appointments";
  tone: "" | "professional" | "friendly" | "consultative";
  ctaText: string;
  templateId: string;
  templateVersion: number | null;
  templateAppliedAt: string;
  lastTestedAt: string;
  goLiveAt: string;
};

type KnowledgeItem = {
  id: string;
  type: string;
};

type SetupStepKey =
  | "basics"
  | "template"
  | "knowledge"
  | "behavior"
  | "design"
  | "embed"
  | "test"
  | "live";

const SETUP_STEPS: Array<{ key: SetupStepKey; label: string; description: string }> = [
  { key: "basics", label: "Basis", description: "Firma und erlaubte Domains" },
  { key: "template", label: "Branche & Vorlage", description: "Branche wählen und Vorlage anwenden" },
  { key: "knowledge", label: "Wissen", description: "Wissensinhalte prüfen" },
  { key: "behavior", label: "Verhalten", description: "Ziel, Tonalität und CTA" },
  { key: "design", label: "Design", description: "Farbe, Logo und Datenschutz" },
  { key: "embed", label: "Einbindung", description: "Code kopieren und Domain prüfen" },
  { key: "test", label: "Testen", description: "Test-Chat durchführen" },
  { key: "live", label: "Live schalten", description: "Bereitschaft prüfen und veröffentlichen" },
];

const WIZARD_STEP_TO_STATUS_STEP: Record<SetupStepKey, CustomerStatusStepKey> = {
  basics: "basics",
  template: "template",
  knowledge: "knowledge",
  behavior: "behavior",
  design: "design",
  embed: "embed",
  test: "test",
  live: "live",
};

const STATUS_STEP_TO_WIZARD_STEP: Partial<Record<CustomerStatusStepKey, SetupStepKey>> = {
  basics: "basics",
  template: "template",
  knowledge: "knowledge",
  behavior: "behavior",
  design: "design",
  embed: "embed",
  test: "test",
  live: "live",
};

const GOAL_OPTIONS = [
  { value: "", label: "Bitte wählen" },
  { value: "lead_capture", label: "Anfragen sammeln" },
  { value: "support", label: "Support beantworten" },
  { value: "product_advice", label: "Produkte empfehlen" },
  { value: "appointments", label: "Termine vorbereiten" },
];

const TONE_OPTIONS = [
  { value: "", label: "Bitte wählen" },
  { value: "professional", label: "Professionell" },
  { value: "friendly", label: "Locker und freundlich" },
  { value: "consultative", label: "Beratend" },
];

function formatDate(value: string) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

function findStatusStep(status: CustomerApiStatus | null, stepKey: SetupStepKey): CustomerStatusStep | undefined {
  return status?.steps?.find((step) => step.key === WIZARD_STEP_TO_STATUS_STEP[stepKey]);
}

function mapStepStatusToTone(step: CustomerStatusStep | undefined): CustomerStatusTone {
  if (step?.status === "complete") {
    return "done";
  }

  if (step?.status === "warning" || step?.status === "blocked") {
    return "attention";
  }

  return "pending";
}

function normalizeDomains(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createEmbedCode(loaderUrl: string, siteKey: string) {
  return `<script src="${loaderUrl}" data-site-key="${siteKey}" defer></script>`;
}

export function CustomerSetupWizard({ siteId }: CustomerSetupWizardProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [overallStatus, setOverallStatus] = useState<CustomerOverallStatus>("Setup unvollständig");
  const [serverStatus, setServerStatus] = useState<CustomerApiStatus | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [loaderUrl, setLoaderUrl] = useState(
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL || "http://localhost:8080/loader.js",
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [basicsForm, setBasicsForm] = useState({ name: "", allowedDomains: "" });
  const [behaviorForm, setBehaviorForm] = useState({
    setupGoal: "" as SiteDetails["setupGoal"],
    tone: "" as SiteDetails["tone"],
    ctaText: "",
    systemPrompt: "",
  });
  const [designForm, setDesignForm] = useState({
    brandColor: "#b55400",
    logoUrl: "",
    privacyUrl: "",
    welcomeMessage: "",
  });

  useEffect(() => {
    setLoaderUrl(resolveWidgetLoaderUrl(process.env.NEXT_PUBLIC_WIDGET_LOADER_URL));
  }, []);

  async function refreshStatus() {
    const response = await fetch(`/api/sites/${siteId}/status`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.status) {
      setOverallStatus(data.status);
      setServerStatus(data);
    }
  }

  async function load() {
    setLoading(true);
    setError(null);

    const [siteRes, knowledgeRes, templatesRes, statusRes] = await Promise.all([
      fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" }),
      fetch(`/api/knowledge?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
      fetch("/api/industry-templates", { cache: "no-store" }),
      fetch(`/api/sites/${siteId}/status`, { cache: "no-store" }),
    ]);

    const siteData = await siteRes.json().catch(() => ({}));
    const knowledgeData = await knowledgeRes.json().catch(() => []);
    const templatesData = await templatesRes.json().catch(() => []);
    const statusData = await statusRes.json().catch(() => ({}));

    if (!siteRes.ok) {
      setError(siteData?.message || "Kundendaten konnten nicht geladen werden.");
      setLoading(false);
      return;
    }

    if (!knowledgeRes.ok) {
      setError(knowledgeData?.message || "Wissensdaten konnten nicht geladen werden.");
      setLoading(false);
      return;
    }

    const nextSite: SiteDetails = {
      id: siteData.id,
      name: siteData.name || "",
      siteKey: siteData.siteKey || "",
      allowedDomains: Array.isArray(siteData.allowedDomains) ? siteData.allowedDomains : [],
      companyName: siteData.companyName || "",
      botName: siteData.botName || "",
      logoUrl: siteData.logoUrl || "",
      brandColor: siteData.brandColor || "#b55400",
      welcomeMessage: siteData.welcomeMessage || "",
      systemPrompt: siteData.systemPrompt || "",
      privacyUrl: siteData.privacyUrl || "",
      industry: siteData.industry || "",
      setupGoal: siteData.setupGoal || "",
      tone: siteData.tone || "",
      ctaText: siteData.ctaText || "",
      templateId: siteData.templateId || "",
      templateVersion: siteData.templateVersion || null,
      templateAppliedAt: siteData.templateAppliedAt || "",
      lastTestedAt: siteData.lastTestedAt || "",
      goLiveAt: siteData.goLiveAt || "",
    };

    setSite(nextSite);
    setTemplates(Array.isArray(templatesData) ? templatesData : []);
    if (statusRes.ok && statusData?.status) {
      setOverallStatus(statusData.status);
      setServerStatus(statusData);
    }
    setBasicsForm({
      name: nextSite.name,
      allowedDomains: nextSite.allowedDomains.join("\n"),
    });
    setBehaviorForm({
      setupGoal: nextSite.setupGoal,
      tone: nextSite.tone,
      ctaText: nextSite.ctaText,
      systemPrompt: nextSite.systemPrompt,
    });
    setDesignForm({
      brandColor: nextSite.brandColor,
      logoUrl: nextSite.logoUrl,
      privacyUrl: nextSite.privacyUrl,
      welcomeMessage: nextSite.welcomeMessage,
    });
    setKnowledge(Array.isArray(knowledgeData) ? knowledgeData : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [siteId]);

  const knowledgeCounts = useMemo(() => {
    const faqCount = knowledge.filter((item) => item.type === "faq").length;
    const pdfCount = knowledge.filter((item) => item.type === "pdf").length;
    return { total: knowledge.length, faqCount, pdfCount };
  }, [knowledge]);

  const currentStep = SETUP_STEPS[activeStepIndex];
  const currentStatusStep = currentStep ? findStatusStep(serverStatus, currentStep.key) : undefined;
  const displayProgress = serverStatus?.progress ?? 0;
  const canGoLive = Boolean(serverStatus?.isLiveReady);
  const liveDone = findStatusStep(serverStatus, "live")?.status === "complete";
  const templateMap = useMemo(() => templatesByKey(templates), [templates]);
  const selectedTemplate = site?.industry ? templateMap[site.industry] : undefined;
  const embedCode = site ? createEmbedCode(loaderUrl, site.siteKey) : "";

  function jumpToStatusStep(statusStepKey: string | undefined) {
    const wizardStep = statusStepKey ? STATUS_STEP_TO_WIZARD_STEP[statusStepKey] : undefined;
    const index = wizardStep ? SETUP_STEPS.findIndex((step) => step.key === wizardStep) : -1;
    if (index >= 0) {
      setActiveStepIndex(index);
    }
  }

  async function saveBasics() {
    setSavingKey("basics");
    setError(null);
    setMessage(null);

    const allowedDomains = normalizeDomains(basicsForm.allowedDomains);
    const response = await fetch(`/api/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: basicsForm.name.trim(),
        allowedDomains,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Basisdaten konnten nicht gespeichert werden.");
      setSavingKey(null);
      return false;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            name: data.name || current.name,
            allowedDomains: Array.isArray(data.allowed_domains) ? data.allowed_domains : allowedDomains,
          }
        : current,
    );
    setMessage("Basisdaten gespeichert.");
    setSavingKey(null);
    await refreshStatus();
    return true;
  }

  async function patchSetup(values: Record<string, unknown>, successMessage: string, key: string) {
    setSavingKey(key);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/config/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Setup-Daten konnten nicht gespeichert werden.");
      setSavingKey(null);
      return false;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            industry: data.industry ?? current.industry,
            setupGoal: data.setupGoal ?? current.setupGoal,
            tone: data.tone ?? current.tone,
            ctaText: data.ctaText ?? current.ctaText,
            systemPrompt: data.systemPrompt ?? current.systemPrompt,
            lastTestedAt: data.lastTestedAt ?? current.lastTestedAt,
            goLiveAt: data.goLiveAt ?? current.goLiveAt,
          }
        : current,
    );
    setMessage(successMessage);
    setSavingKey(null);
    await refreshStatus();
    return true;
  }

  async function saveBehavior() {
    return patchSetup(
      {
        setupGoal: behaviorForm.setupGoal,
        tone: behaviorForm.tone,
        ctaText: behaviorForm.ctaText.trim(),
        systemPrompt: behaviorForm.systemPrompt.trim(),
      },
      "Verhalten gespeichert.",
      "behavior",
    );
  }

  async function saveDesign() {
    setSavingKey("design");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/branding/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandColor: designForm.brandColor,
        logoUrl: designForm.logoUrl.trim(),
        privacyUrl: designForm.privacyUrl.trim(),
        welcomeMessage: designForm.welcomeMessage.trim(),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Design konnte nicht gespeichert werden.");
      setSavingKey(null);
      return false;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            brandColor: data.brandColor ?? current.brandColor,
            logoUrl: data.logoUrl ?? current.logoUrl,
            privacyUrl: data.privacyUrl ?? current.privacyUrl,
            welcomeMessage: data.welcomeMessage ?? current.welcomeMessage,
          }
        : current,
    );
    setMessage("Design gespeichert.");
    setSavingKey(null);
    await refreshStatus();
    return true;
  }

  async function saveTemplateChoice() {
    if (!site) {
      return false;
    }

    return patchSetup({ industry: site.industry }, "Branche gespeichert.", "template");
  }

  async function applyIndustryTemplate() {
    if (!site) {
      return false;
    }

    const template = templateMap[site.industry];
    if (!template) {
      setError("Für diese Branche ist noch keine Vorlage hinterlegt.");
      return false;
    }

    setSavingKey("template");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/sites/${siteId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.key, mode: "overwrite" }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data?.message || "Vorlage konnte nicht vollständig angewendet werden.");
        return false;
      }

      await load();
      setMessage(`Vorlage „${template.label}“ angewendet.`);
      return true;
    } finally {
      setSavingKey(null);
    }
  }

  async function copyEmbedCode() {
    if (!embedCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied("Einbindungscode");
      setError(null);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Einbindungscode konnte nicht kopiert werden.");
    }
  }

  async function markTested() {
    return patchSetup({ lastTestedAt: new Date().toISOString() }, "Test als erledigt markiert.", "test");
  }

  async function goLive() {
    setSavingKey("live");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}/go-live`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.message || data?.status?.label || "Kunde konnte nicht live geschaltet werden.");
      setSavingKey(null);
      if (data?.status) {
        setServerStatus(data.status);
        setOverallStatus(data.status.status || data.status.label);
      }
      return false;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            goLiveAt: data?.status?.goLiveAt || new Date().toISOString(),
          }
        : current,
    );
    if (data?.status) {
      setServerStatus(data.status);
      setOverallStatus(data.status.status || data.status.label);
    }
    setMessage("Kunde live geschaltet.");
    setSavingKey(null);
    return true;
  }

  async function saveCurrentStep() {
    if (!currentStep || !site) {
      return false;
    }

    switch (currentStep.key) {
      case "basics":
        return saveBasics();
      case "template":
        return saveTemplateChoice();
      case "behavior":
        return saveBehavior();
      case "design":
        return saveDesign();
      case "test":
        return markTested();
      case "live":
        return goLive();
      default:
        return true;
    }
  }

  async function goNext() {
    const saved = await saveCurrentStep();
    if (!saved) {
      return;
    }

    setActiveStepIndex((current) => Math.min(current + 1, SETUP_STEPS.length - 1));
  }

  function skipStep() {
    setActiveStepIndex((current) => Math.min(current + 1, SETUP_STEPS.length - 1));
  }

  function renderCurrentStep() {
    if (!site || !currentStep) {
      return null;
    }

    const statusBadge = <CustomerStatusBadge status={mapStepStatusToTone(currentStatusStep)} />;

    switch (currentStep.key) {
      case "basics":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Basis"
              description="Lege fest, wie der Kunde intern heißt und auf welchen Domains das Widget laufen darf."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Firmenname</span>
                <Input
                  value={basicsForm.name}
                  onChange={(event) => setBasicsForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Erlaubte Domains</span>
                <textarea
                  className="dashboard-textarea"
                  rows={3}
                  value={basicsForm.allowedDomains}
                  onChange={(event) =>
                    setBasicsForm((current) => ({ ...current, allowedDomains: event.target.value }))
                  }
                  placeholder="soulesmartbusiness.com"
                />
              </label>
            </div>
            <Button type="button" onClick={saveBasics} disabled={savingKey === "basics"}>
              {savingKey === "basics" ? "Speichert..." : "Basis speichern"}
            </Button>
          </section>
        );

      case "template":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Branche & Vorlage"
              description="Wähle die Branche und wende die passende Vorlage an. Dadurch werden Ziel, Verhalten, Fragen und Defaults vorbereitet."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <label className="dashboard-field">
              <span className="dashboard-field-label">Branche</span>
              <Select
                value={site.industry}
                onChange={(event) =>
                  setSite((current) => (current ? { ...current, industry: event.target.value } : current))
                }
              >
                <option value="">Bitte wählen</option>
                {templates.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <strong>{selectedTemplate?.label || "Keine Vorlage ausgewählt"}</strong>
              <p className="dashboard-copy dashboard-copy--muted">
                Angewendet: {site.templateId ? `${site.templateId} v${site.templateVersion || "?"}` : "Noch nicht"}
                {site.templateAppliedAt ? `, ${formatDate(site.templateAppliedAt)}` : ""}
              </p>
              <div className="dashboard-inline dashboard-wrap">
                <Button type="button" variant="secondary" onClick={saveTemplateChoice} disabled={savingKey === "template"}>
                  Branche speichern
                </Button>
                <Button
                  type="button"
                  onClick={applyIndustryTemplate}
                  disabled={savingKey === "template" || !site.industry || !selectedTemplate}
                >
                  {savingKey === "template" ? "Wird angewendet..." : "Vorlage anwenden"}
                </Button>
              </div>
            </div>
          </section>
        );

      case "knowledge":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Wissen"
              description="Prüfe, ob genügend Wissensinhalte vorhanden sind. Uploads und FAQs bleiben auf der Wissensseite."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-grid dashboard-grid--metrics-3">
              <Metric label="Wissensinhalte" value={knowledgeCounts.total} />
              <Metric label="FAQ-Einträge" value={knowledgeCounts.faqCount} />
              <Metric label="PDF-Dokumente" value={knowledgeCounts.pdfCount} />
            </div>
            <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
              Wissen hinzufügen
            </Link>
          </section>
        );

      case "behavior":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Verhalten"
              description="Lege Ziel, Tonalität, CTA und Gesprächsanweisung in einfachen Worten fest."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Bot-Ziel</span>
                <Select
                  value={behaviorForm.setupGoal}
                  onChange={(event) =>
                    setBehaviorForm((current) => ({
                      ...current,
                      setupGoal: event.target.value as SiteDetails["setupGoal"],
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
                <span className="dashboard-field-label">Tonalität</span>
                <Select
                  value={behaviorForm.tone}
                  onChange={(event) =>
                    setBehaviorForm((current) => ({ ...current, tone: event.target.value as SiteDetails["tone"] }))
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
            <label className="dashboard-field">
              <span className="dashboard-field-label">CTA</span>
              <Input
                value={behaviorForm.ctaText}
                onChange={(event) => setBehaviorForm((current) => ({ ...current, ctaText: event.target.value }))}
                placeholder="Zum Kontaktformular führen"
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Gesprächsanweisung</span>
              <textarea
                className="dashboard-textarea"
                rows={5}
                value={behaviorForm.systemPrompt}
                onChange={(event) =>
                  setBehaviorForm((current) => ({ ...current, systemPrompt: event.target.value }))
                }
                placeholder="Beispiel: Antworte professionell, stelle maximal eine Rückfrage und leite bei konkretem Bedarf zur Kontaktaufnahme."
              />
            </label>
            <div className="dashboard-inline dashboard-wrap">
              <Button type="button" onClick={saveBehavior} disabled={savingKey === "behavior"}>
                {savingKey === "behavior" ? "Speichert..." : "Verhalten speichern"}
              </Button>
              <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
                Verhalten im Detail öffnen
              </Link>
            </div>
          </section>
        );

      case "design":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Design"
              description="Setze Farbe, Logo, Begrüßung und Datenschutz-URL. Die Datenschutz-URL ist vor Live Pflicht."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-grid dashboard-grid--two">
              <label className="dashboard-field">
                <span className="dashboard-field-label">Farbe</span>
                <Input
                  type="color"
                  value={designForm.brandColor}
                  onChange={(event) => setDesignForm((current) => ({ ...current, brandColor: event.target.value }))}
                />
              </label>
              <label className="dashboard-field">
                <span className="dashboard-field-label">Logo URL</span>
                <Input
                  value={designForm.logoUrl}
                  onChange={(event) => setDesignForm((current) => ({ ...current, logoUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </label>
            </div>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Datenschutz-URL</span>
              <Input
                value={designForm.privacyUrl}
                onChange={(event) => setDesignForm((current) => ({ ...current, privacyUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Begrüßung</span>
              <textarea
                className="dashboard-textarea"
                rows={3}
                value={designForm.welcomeMessage}
                onChange={(event) => setDesignForm((current) => ({ ...current, welcomeMessage: event.target.value }))}
              />
            </label>
            <div className="dashboard-info-row">
              <strong>Widget-Position</strong>
              <span>Unten rechts</span>
            </div>
            <div className="dashboard-inline dashboard-wrap">
              <Button type="button" onClick={saveDesign} disabled={savingKey === "design"}>
                {savingKey === "design" ? "Speichert..." : "Design speichern"}
              </Button>
              <Link href={`/sites/${siteSlug}/branding`} className="dashboard-button dashboard-button--secondary">
                Design im Detail öffnen
              </Link>
            </div>
          </section>
        );

      case "embed":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Einbindung"
              description="Kopiere den Einbindungscode und prüfe die erlaubten Domains."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-info-row">
              <strong>Einbindungscode</strong>
              <span className="dashboard-breakword dashboard-mono">{site.siteKey || "Noch nicht vorhanden"}</span>
            </div>
            <div className="dashboard-info-row">
              <strong>Erlaubte Domains</strong>
              <span>{site.allowedDomains.length > 0 ? site.allowedDomains.join(", ") : "Noch nicht gesetzt"}</span>
            </div>
            <textarea className="dashboard-textarea dashboard-mono" readOnly value={embedCode} />
            <div className="dashboard-inline dashboard-wrap">
              <Button type="button" onClick={copyEmbedCode} disabled={!embedCode}>
                Einbindungscode kopieren
              </Button>
              <Link href={`/sites/${siteSlug}/embedding`} className="dashboard-button dashboard-button--secondary">
                Einbindung im Detail öffnen
              </Link>
            </div>
            {copied ? <p className="dashboard-status dashboard-status--success">{copied} kopiert.</p> : null}
          </section>
        );

      case "test":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Testen"
              description="Führe einen Test-Chat durch und markiere den Kunden danach als getestet."
              badge={statusBadge}
              statusStep={currentStatusStep}
            />
            <div className="dashboard-info-row">
              <strong>Letzter Test</strong>
              <span>{formatDate(site.lastTestedAt)}</span>
            </div>
            <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
              <strong>Test-Checkliste</strong>
              <p className="dashboard-copy dashboard-copy--muted">
                Prüfe Begrüßung, zwei typische Fragen, CTA und Einbindung. Der eigentliche Test-Chat liegt auf der Kundenübersicht.
              </p>
            </div>
            <div className="dashboard-inline dashboard-wrap">
              <Link href={`/sites/${siteSlug}#customer-test-chat`} className="dashboard-button dashboard-button--secondary">
                Test-Chat öffnen
              </Link>
              <Button type="button" onClick={markTested} disabled={savingKey === "test"}>
                {savingKey === "test" ? "Speichert..." : "Als getestet markieren"}
              </Button>
            </div>
          </section>
        );

      case "live":
        return (
          <section className="dashboard-card dashboard-stack">
            <StepHeader
              title="Live schalten"
              description="Live ist erst möglich, wenn der Backend-Status alle Pflichtpunkte bestätigt."
              badge={
                <CustomerStatusBadge
                  status={liveDone ? "done" : canGoLive ? "pending" : "attention"}
                  label={liveDone ? "Live" : canGoLive ? "Bereit" : "Vorbereitung offen"}
                />
              }
              statusStep={currentStatusStep}
            />
            <div className="dashboard-info-row">
              <strong>Aktueller Status</strong>
              <span>{serverStatus?.label || overallStatus}</span>
            </div>
            <div className="dashboard-info-row">
              <strong>Live seit</strong>
              <span>{formatDate(site.goLiveAt)}</span>
            </div>
            {serverStatus?.missingSteps?.length ? (
              <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                <strong>Noch offen</strong>
                <div className="dashboard-inline dashboard-wrap">
                  {serverStatus.missingSteps.map((step) => (
                    <button
                      key={step}
                      type="button"
                      className="dashboard-link-card"
                      onClick={() => jumpToStatusStep(step)}
                    >
                      {serverStatus.steps.find((entry) => entry.key === step)?.label || step}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Button type="button" onClick={goLive} disabled={!canGoLive || savingKey === "live" || liveDone}>
              {savingKey === "live" ? "Speichert..." : liveDone ? "Bereits live" : "Live schalten"}
            </Button>
          </section>
        );
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error && !site) {
    return <ErrorState message={error} />;
  }

  if (!site) {
    return <ErrorState message="Kundendaten konnten nicht geladen werden." />;
  }

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <div>
            <h2 className="dashboard-card-title">Geführte Einrichtung</h2>
            <p className="dashboard-copy">
              Schritt für Schritt: Basis, Vorlage, Wissen, Verhalten, Design, Einbindung, Test und Live-Schaltung.
            </p>
          </div>
          <div className="dashboard-stack dashboard-stack--sm">
            <div className="dashboard-card dashboard-card--soft">
              <strong>
                Schritt {activeStepIndex + 1} von {SETUP_STEPS.length}
              </strong>
              <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
                {displayProgress}% Fortschritt
              </p>
            </div>
            <CustomerStatusBadge
              status={serverStatus ? mapStatusSeverityToTone(serverStatus.severity) : mapOverallStatusToTone(overallStatus)}
              label={serverStatus?.label || overallStatus}
            />
          </div>
        </div>

        {serverStatus?.nextAction ? (
          <div className="dashboard-card dashboard-card--soft dashboard-info-row">
            <strong>Nächste sinnvolle Aktion</strong>
            {serverStatus.nextAction.href ? (
              <Link href={serverStatus.nextAction.href} className="dashboard-link-card">
                {serverStatus.nextAction.label}
              </Link>
            ) : (
              <button
                type="button"
                className="dashboard-link-card"
                onClick={() => jumpToStatusStep(serverStatus.nextAction?.key)}
              >
                {serverStatus.nextAction.label}
              </button>
            )}
          </div>
        ) : null}

        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
        {error ? <ErrorState message={error} /> : null}

        <div className="dashboard-setup-steps">
          {SETUP_STEPS.map((step, index) => {
            const stepStatus = findStatusStep(serverStatus, step.key);
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
                  <span className="dashboard-copy dashboard-copy--muted" style={{ display: "block", marginBottom: 0 }}>
                    {step.description}
                  </span>
                </span>
                <CustomerStatusBadge status={mapStepStatusToTone(stepStatus)} />
              </button>
            );
          })}
        </div>
      </section>

      {renderCurrentStep()}

      <section className="dashboard-card dashboard-inline dashboard-inline--spaced dashboard-wrap">
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
          {currentStep.key !== "live" ? (
            <Button type="button" variant="secondary" onClick={skipStep} disabled={Boolean(savingKey)}>
              Überspringen
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={currentStep.key === "live" ? goLive : goNext}
            disabled={Boolean(savingKey) || (currentStep.key === "live" && (!canGoLive || liveDone))}
          >
            {currentStep.key === "live" ? "Live schalten" : "Weiter"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function StepHeader({
  title,
  description,
  badge,
  statusStep,
}: {
  title: string;
  description: string;
  badge: ReactNode;
  statusStep?: CustomerStatusStep;
}) {
  return (
    <div className="dashboard-stack dashboard-stack--sm">
      <div className="dashboard-info-row">
        <div>
          <strong>{title}</strong>
          <p className="dashboard-copy dashboard-copy--muted">{description}</p>
        </div>
        {badge}
      </div>
      {statusStep?.missingReason ? (
        <p className="dashboard-status dashboard-status--error">{statusStep.missingReason}</p>
      ) : null}
      {statusStep?.nextAction?.href ? (
        <Link href={statusStep.nextAction.href} className="dashboard-link-card">
          {statusStep.nextAction.label}
        </Link>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-copy--muted">{label}</p>
    </div>
  );
}
