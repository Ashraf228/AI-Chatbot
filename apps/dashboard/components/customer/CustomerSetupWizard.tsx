"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { encodeSiteId } from "../../lib/site-id";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import {
  mapStatusSeverityToTone,
  mapOverallStatusToTone,
  type CustomerApiStatus,
  type CustomerOverallStatus,
} from "./customer-status";
import { type IndustryTemplate, templatesByKey } from "../../lib/industry-templates";

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
  lastTestedAt: string;
  goLiveAt: string;
};

type KnowledgeItem = {
  id: string;
  type: string;
};

const GOAL_OPTIONS = [
  { value: "", label: "Bitte wählen" },
  { value: "lead_capture", label: "Leads sammeln" },
  { value: "support", label: "Support beantworten" },
  { value: "product_advice", label: "Produkte empfehlen" },
  { value: "appointments", label: "Termine vorbereiten" },
];

type SetupStepKey =
  | "basics"
  | "industry"
  | "template"
  | "knowledge"
  | "goal"
  | "behavior"
  | "design"
  | "embedding"
  | "testing"
  | "live";

type SetupStepState = Record<SetupStepKey, boolean>;

const SETUP_STEPS: Array<{ key: SetupStepKey; label: string; anchor: string }> = [
  { key: "basics", label: "Firma & Domain", anchor: "setup-step-basics" },
  { key: "industry", label: "Branche", anchor: "setup-step-industry" },
  { key: "template", label: "Vorlage", anchor: "setup-step-template" },
  { key: "knowledge", label: "Wissen", anchor: "setup-step-knowledge" },
  { key: "goal", label: "Bot-Ziel", anchor: "setup-step-goal" },
  { key: "behavior", label: "Verhalten", anchor: "setup-step-behavior" },
  { key: "design", label: "Design", anchor: "setup-step-design" },
  { key: "embedding", label: "Einbindung", anchor: "setup-step-embedding" },
  { key: "testing", label: "Testen", anchor: "setup-step-testing" },
  { key: "live", label: "Live", anchor: "setup-step-live" },
];

function formatDate(value: string) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function CustomerSetupWizard({ siteId }: CustomerSetupWizardProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [templates, setTemplates] = useState<IndustryTemplate[]>([]);
  const [overallStatus, setOverallStatus] = useState<CustomerOverallStatus>("Setup unvollständig");
  const [serverStatus, setServerStatus] = useState<CustomerApiStatus | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [basicsForm, setBasicsForm] = useState({ name: "", domain: "" });
  const [behaviorForm, setBehaviorForm] = useState({ systemPrompt: "" });

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
      domain: nextSite.allowedDomains[0] || "",
    });
    setBehaviorForm({
      systemPrompt: nextSite.systemPrompt,
    });
    setKnowledge(Array.isArray(knowledgeData) ? knowledgeData : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [siteId]);

  const counts = useMemo(() => {
    const faqCount = knowledge.filter((item) => item.type === "faq").length;
    const pdfCount = knowledge.filter((item) => item.type === "pdf").length;
    return { total: knowledge.length, faqCount, pdfCount };
  }, [knowledge]);

  const progress = useMemo(() => {
    if (!site) {
      return { completed: 0, total: SETUP_STEPS.length, steps: {} as SetupStepState };
    }

    const basicsDone = Boolean(site.name.trim() && site.allowedDomains.length > 0);
    const industryDone = Boolean(site.industry);
    const templateDone = Boolean(site.industry && site.setupGoal && (site.systemPrompt || site.welcomeMessage));
    const knowledgeDone = counts.total > 0;
    const goalDone = Boolean(site.setupGoal);
    const behaviorDone = Boolean(site.systemPrompt || site.welcomeMessage);
    const designDone = Boolean(
      site.logoUrl ||
        (site.brandColor && site.brandColor !== "#b55400") ||
        (site.welcomeMessage && site.welcomeMessage !== "Hi! Wie kann ich helfen?"),
    );
    const embeddingDone = Boolean(site.siteKey && site.allowedDomains.length > 0);
    const testingDone = Boolean(site.lastTestedAt);
    const liveDone = Boolean(site.goLiveAt);
    const steps: SetupStepState = {
      basics: basicsDone,
      industry: industryDone,
      template: templateDone,
      knowledge: knowledgeDone,
      goal: goalDone,
      behavior: behaviorDone,
      design: designDone,
      embedding: embeddingDone,
      testing: testingDone,
      live: liveDone,
    };

    const completed = Object.values(steps).filter(Boolean).length;

    return {
      completed,
      total: SETUP_STEPS.length,
      steps,
      basicsDone,
      industryDone,
      templateDone,
      knowledgeDone,
      goalDone,
      behaviorDone,
      designDone,
      embeddingDone,
      testingDone,
      liveDone,
    };
  }, [counts.total, site]);

  async function saveBasics() {
    setSavingKey("basics");
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: basicsForm.name.trim(),
        allowedDomains: basicsForm.domain.trim() ? [basicsForm.domain.trim()] : [],
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
            allowedDomains: Array.isArray(data.allowed_domains) ? data.allowed_domains : current.allowedDomains,
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

  async function applyIndustryTemplate() {
    if (!site) {
      return false;
    }

    const template = templatesByKey(templates)[site.industry];
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
        setSavingKey(null);
        return false;
      }

      await load();
      setMessage(`Vorlage „${template.label}“ angewendet.`);
      return true;
    } finally {
      setSavingKey(null);
    }
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
    const step = SETUP_STEPS[activeStepIndex]?.key;
    if (!step || !site) {
      return false;
    }

    switch (step) {
      case "basics":
        return saveBasics();
      case "industry":
        return patchSetup({ industry: site.industry }, "Branche gespeichert.", "industry");
      case "template":
        return applyIndustryTemplate();
      case "goal":
        return patchSetup({ setupGoal: site.setupGoal }, "Bot-Ziel gespeichert.", "goal");
      case "behavior":
        return patchSetup(
          { systemPrompt: behaviorForm.systemPrompt.trim() },
          "Verhalten gespeichert.",
          "behavior",
        );
      case "testing":
        return patchSetup(
          { lastTestedAt: new Date().toISOString() },
          "Test als erledigt markiert.",
          "testing",
        );
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

  if (loading) {
    return <LoadingState />;
  }

  if (error && !site) {
    return <ErrorState message={error} />;
  }

  if (!site) {
    return <ErrorState message="Kundendaten konnten nicht geladen werden." />;
  }

  const currentStep = SETUP_STEPS[activeStepIndex];
  const displayProgress = serverStatus?.progress ?? Math.round((progress.completed / progress.total) * 100);
  const canGoLive = Boolean(serverStatus?.isLiveReady);

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <div>
            <h2 className="dashboard-card-title">Geführte Einrichtung</h2>
            <p className="dashboard-copy">
              Richte diesen Kunden in einer festen Reihenfolge ein: Basisdaten, Wissen, Verhalten,
              Einbindung, Test und Live-Schaltung.
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
            <Link href={serverStatus.nextAction.href} className="dashboard-link-card">
              {serverStatus.nextAction.label}
            </Link>
          </div>
        ) : null}

        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
        {error ? <ErrorState message={error} /> : null}

        <div className="dashboard-setup-steps">
          {SETUP_STEPS.map((step, index) => (
            <button
              key={step.key}
              type="button"
              className="dashboard-setup-step"
              onClick={() => setActiveStepIndex(index)}
            >
              <span className="dashboard-setup-step__number">{index + 1}</span>
              <span>{step.label}</span>
              <CustomerStatusBadge status={progress.steps[step.key] ? "done" : "pending"} />
            </button>
          ))}
        </div>
      </section>

      <section id="setup-step-basics" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "basics"}>
        <div className="dashboard-info-row">
          <div>
            <strong>1. Firma & Domain</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Lege fest, wie der Kunde intern heißt und auf welcher Hauptdomain das Widget läuft.
            </p>
          </div>
          <CustomerStatusBadge status={progress.basicsDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-grid dashboard-grid--two">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Firmenname</span>
            <Input
              value={basicsForm.name}
              onChange={(event) => setBasicsForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Hauptdomain</span>
            <Input
              value={basicsForm.domain}
              onChange={(event) => setBasicsForm((current) => ({ ...current, domain: event.target.value }))}
            />
          </label>
        </div>
        <Button type="button" onClick={saveBasics} disabled={savingKey === "basics"}>
          {savingKey === "basics" ? "Speichert..." : "Basisdaten speichern"}
        </Button>
      </section>

      <section id="setup-step-industry" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "industry"}>
        <div className="dashboard-info-row">
          <div>
            <strong>2. Branche auswählen</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Diese Auswahl steuert später Templates, Standardfragen und empfohlene Funktionen.
            </p>
          </div>
          <CustomerStatusBadge status={progress.industryDone ? "done" : "pending"} />
        </div>
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
        <Button
          type="button"
          onClick={() => patchSetup({ industry: site.industry }, "Branche gespeichert.", "industry")}
          disabled={savingKey === "industry"}
        >
          {savingKey === "industry" ? "Speichert..." : "Branche speichern"}
        </Button>
      </section>

      <section id="setup-step-template" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "template"}>
        <div className="dashboard-info-row">
          <div>
            <strong>3. Vorlage anwenden</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Setzt Standardziel, Begrüßung, typische Fragen und empfohlene Funktionen für diese Branche.
            </p>
          </div>
          <CustomerStatusBadge status={progress.templateDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>{templatesByKey(templates)[site.industry]?.label || "Keine Branche ausgewählt"}</strong>
          <p className="dashboard-copy dashboard-copy--muted">
            Nach dem Anwenden kann ein Mitarbeiter nur noch die Abweichungen prüfen, statt alles manuell einzustellen.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={applyIndustryTemplate}
            disabled={savingKey === "template" || !site.industry || !templatesByKey(templates)[site.industry]}
          >
            {savingKey === "template" ? "Vorlage wird angewendet..." : "Vorlage anwenden"}
          </Button>
        </div>
      </section>

      <section id="setup-step-knowledge" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "knowledge"}>
        <div className="dashboard-info-row">
          <div>
            <strong>4. Wissen importieren</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Hinterlege FAQs und PDFs, damit der Bot fachlich sauber antworten kann.
            </p>
          </div>
          <CustomerStatusBadge status={progress.knowledgeDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-3">
          <div className="dashboard-card dashboard-card--soft">
            <strong>{counts.total}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Wissensinhalte gesamt</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{counts.faqCount}</strong>
            <p className="dashboard-copy dashboard-copy--muted">FAQ-Einträge</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{counts.pdfCount}</strong>
            <p className="dashboard-copy dashboard-copy--muted">PDF-Dokumente</p>
          </div>
        </div>
        <div className="dashboard-inline dashboard-wrap">
          <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
            Wissen öffnen
          </Link>
        </div>
      </section>

      <section id="setup-step-goal" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "goal"}>
        <div className="dashboard-info-row">
          <div>
            <strong>5. Bot-Ziel festlegen</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Lege fest, worauf der Bot im Gespräch hauptsächlich hinausarbeiten soll.
            </p>
          </div>
          <CustomerStatusBadge status={progress.goalDone ? "done" : "pending"} />
        </div>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Bot-Ziel</span>
          <Select
            value={site.setupGoal}
            onChange={(event) =>
              setSite((current) =>
                current ? { ...current, setupGoal: event.target.value as SiteDetails["setupGoal"] } : current,
              )
            }
          >
            {GOAL_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <div className="dashboard-inline dashboard-wrap">
          <Button
            type="button"
            onClick={() =>
              patchSetup({ setupGoal: site.setupGoal }, "Bot-Ziel gespeichert.", "goal")
            }
            disabled={savingKey === "goal"}
          >
            {savingKey === "goal" ? "Speichert..." : "Bot-Ziel speichern"}
          </Button>
          <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
            Verhalten öffnen
          </Link>
        </div>
      </section>

      <section id="setup-step-behavior" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "behavior"}>
        <div className="dashboard-info-row">
          <div>
            <strong>6. Verhalten festlegen</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Beschreibe in normalen Worten, wie der Bot sprechen und führen soll. Das bleibt bewusst getrennt vom Design.
            </p>
          </div>
          <CustomerStatusBadge status={progress.behaviorDone ? "done" : "pending"} />
        </div>
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
          <Button
            type="button"
            onClick={() =>
              patchSetup(
                { systemPrompt: behaviorForm.systemPrompt.trim() },
                "Verhalten gespeichert.",
                "behavior",
              )
            }
            disabled={savingKey === "behavior"}
          >
            {savingKey === "behavior" ? "Speichert..." : "Verhalten speichern"}
          </Button>
          <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
            Detailseite öffnen
          </Link>
        </div>
      </section>

      <section id="setup-step-design" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "design"}>
        <div className="dashboard-info-row">
          <div>
            <strong>7. Design einstellen</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Logo, Farben und Begrüßung anpassen, damit der Bot zum Kundenauftritt passt.
            </p>
          </div>
          <CustomerStatusBadge status={progress.designDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-info-row">
          <strong>Aktueller Stand</strong>
          <span>
            {site.logoUrl ? "Logo vorhanden" : "Kein Logo"}, Farbe {site.brandColor}, Begrüßung{" "}
            {site.welcomeMessage ? "gesetzt" : "offen"}
          </span>
        </div>
        <Link href={`/sites/${siteSlug}/branding`} className="dashboard-button dashboard-button--secondary">
          Design öffnen
        </Link>
      </section>

      <section id="setup-step-embedding" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "embedding"}>
        <div className="dashboard-info-row">
          <div>
            <strong>8. Einbindung</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Prüfe Einbindungsschlüssel, Script-Tag und erlaubte Domain für die Kundenseite.
            </p>
          </div>
          <CustomerStatusBadge status={progress.embeddingDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-info-row">
          <strong>Einbindungsschlüssel</strong>
          <span className="dashboard-mono">{site.siteKey || "Noch nicht vorhanden"}</span>
        </div>
        <Link href={`/sites/${siteSlug}/embedding`} className="dashboard-button dashboard-button--secondary">
          Einbindung öffnen
        </Link>
      </section>

      <section id="setup-step-testing" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "testing"}>
        <div className="dashboard-info-row">
          <div>
            <strong>9. Testen</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Prüfe den Bot einmal im Test und markiere die Einrichtung anschließend als geprüft.
            </p>
          </div>
          <CustomerStatusBadge status={progress.testingDone ? "done" : "pending"} />
        </div>
        <div className="dashboard-info-row">
          <strong>Letzter Test</strong>
          <span>{formatDate(site.lastTestedAt)}</span>
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Test-Checkliste</strong>
          <p className="dashboard-copy dashboard-copy--muted">
            Prüfe mindestens Begrüßung, zwei bis drei typische Fragen, den Kontakt-CTA und die erlaubte Domain.
          </p>
        </div>
        <div className="dashboard-inline dashboard-wrap">
          <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
            Wissen prüfen
          </Link>
          <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
            Verhalten prüfen
          </Link>
          <Link href={`/sites/${siteSlug}/embedding`} className="dashboard-button dashboard-button--secondary">
            Einbindung prüfen
          </Link>
          <Button
            type="button"
            onClick={() =>
              patchSetup(
                { lastTestedAt: new Date().toISOString() },
                "Test als erledigt markiert.",
                "testing",
              )
            }
            disabled={savingKey === "testing"}
          >
            {savingKey === "testing" ? "Speichert..." : "Als getestet markieren"}
          </Button>
        </div>
      </section>

      <section id="setup-step-live" className="dashboard-card dashboard-stack" hidden={currentStep.key !== "live"}>
        <div className="dashboard-info-row">
          <div>
            <strong>10. Live schalten</strong>
            <p className="dashboard-copy dashboard-copy--muted">
              Schalte den Kunden live, sobald Einrichtung, Einbindung und Test abgeschlossen sind.
            </p>
          </div>
          <CustomerStatusBadge
            status={progress.liveDone ? "done" : canGoLive ? "pending" : "attention"}
            label={progress.liveDone ? "Live" : canGoLive ? "Bereit" : "Vorbereitung offen"}
          />
        </div>
        <div className="dashboard-info-row">
          <strong>Live seit</strong>
          <span>{formatDate(site.goLiveAt)}</span>
        </div>
        <Button
          type="button"
          onClick={goLive}
          disabled={!canGoLive || savingKey === "live" || progress.liveDone}
        >
          {savingKey === "live" ? "Speichert..." : progress.liveDone ? "Bereits live" : "Live schalten"}
        </Button>
      </section>

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
          <Button
            type="button"
            variant="secondary"
            onClick={saveCurrentStep}
            disabled={Boolean(savingKey)}
          >
            {savingKey ? "Speichert..." : "Speichern"}
          </Button>
          {currentStep.key !== "live" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={skipStep}
              disabled={Boolean(savingKey)}
            >
              Überspringen
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={currentStep.key === "live" ? goLive : goNext}
            disabled={Boolean(savingKey) || (currentStep.key === "live" && (!canGoLive || progress.liveDone))}
          >
            {currentStep.key === "live" ? "Live schalten" : "Weiter"}
          </Button>
        </div>
      </section>
    </div>
  );
}
