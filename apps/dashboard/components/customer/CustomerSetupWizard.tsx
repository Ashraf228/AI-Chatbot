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
  industry: string;
  setupGoal: "" | "lead_capture" | "support" | "product_advice" | "appointments";
  lastTestedAt: string;
  goLiveAt: string;
};

type KnowledgeItem = {
  id: string;
  type: string;
};

const INDUSTRY_OPTIONS = [
  { value: "", label: "Bitte wählen" },
  { value: "local-services", label: "Lokaler Dienstleister" },
  { value: "ecommerce-shopify", label: "E-Commerce / Shopify" },
  { value: "property-management", label: "Immobilienverwaltung" },
  { value: "it-support", label: "IT-Support" },
  { value: "medical-practice", label: "Arztpraxis" },
  { value: "fitness-studio", label: "Fitnessstudio" },
  { value: "cleaning-trades", label: "Reinigung / Handwerk" },
];

const GOAL_OPTIONS = [
  { value: "", label: "Bitte wählen" },
  { value: "lead_capture", label: "Leads sammeln" },
  { value: "support", label: "Support beantworten" },
  { value: "product_advice", label: "Produkte empfehlen" },
  { value: "appointments", label: "Termine vorbereiten" },
];

function formatDate(value: string) {
  if (!value) {
    return "Noch nicht gesetzt";
  }

  return new Date(value).toLocaleString("de-DE");
}

function isDesignConfigured(site: SiteDetails) {
  return Boolean(
    site.logoUrl ||
      (site.brandColor && site.brandColor !== "#b55400") ||
      (site.welcomeMessage && site.welcomeMessage !== "Hi! Wie kann ich helfen?"),
  );
}

export function CustomerSetupWizard({ siteId }: CustomerSetupWizardProps) {
  const siteSlug = encodeSiteId(siteId);
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [basicsForm, setBasicsForm] = useState({ name: "", domain: "" });

  async function load() {
    setLoading(true);
    setError(null);

    const [siteRes, knowledgeRes] = await Promise.all([
      fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" }),
      fetch(`/api/knowledge?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
    ]);

    const siteData = await siteRes.json().catch(() => ({}));
    const knowledgeData = await knowledgeRes.json().catch(() => []);

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
      industry: siteData.industry || "",
      setupGoal: siteData.setupGoal || "",
      lastTestedAt: siteData.lastTestedAt || "",
      goLiveAt: siteData.goLiveAt || "",
    };

    setSite(nextSite);
    setBasicsForm({
      name: nextSite.name,
      domain: nextSite.allowedDomains[0] || "",
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
      return { completed: 0, total: 8 };
    }

    const basicsDone = Boolean(site.name.trim() && site.allowedDomains.length > 0);
    const industryDone = Boolean(site.industry);
    const knowledgeDone = counts.total > 0;
    const goalDone = Boolean(site.setupGoal);
    const designDone = isDesignConfigured(site);
    const embeddingDone = Boolean(site.siteKey && site.allowedDomains.length > 0);
    const testingDone = Boolean(site.lastTestedAt);
    const liveDone = Boolean(site.goLiveAt);

    const completed = [
      basicsDone,
      industryDone,
      knowledgeDone,
      goalDone,
      designDone,
      embeddingDone,
      testingDone,
      liveDone,
    ].filter(Boolean).length;

    return {
      completed,
      total: 8,
      basicsDone,
      industryDone,
      knowledgeDone,
      goalDone,
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
      return;
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
      return;
    }

    setSite((current) =>
      current
        ? {
            ...current,
            industry: data.industry ?? current.industry,
            setupGoal: data.setupGoal ?? current.setupGoal,
            lastTestedAt: data.lastTestedAt ?? current.lastTestedAt,
            goLiveAt: data.goLiveAt ?? current.goLiveAt,
          }
        : current,
    );
    setMessage(successMessage);
    setSavingKey(null);
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

  const canGoLive =
    progress.basicsDone &&
    progress.industryDone &&
    progress.knowledgeDone &&
    progress.goalDone &&
    progress.designDone &&
    progress.embeddingDone &&
    progress.testingDone;

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
          <div className="dashboard-card dashboard-card--soft">
            <strong>
              {progress.completed} / {progress.total} Schritte
            </strong>
            <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
              Aktueller Fortschritt
            </p>
          </div>
        </div>

        {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
        {error ? <ErrorState message={error} /> : null}
      </section>

      <section className="dashboard-card dashboard-stack">
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

      <section className="dashboard-card dashboard-stack">
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
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>3. Wissen importieren</strong>
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>4. Bot-Ziel festlegen</strong>
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>5. Design einstellen</strong>
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>6. Einbindung</strong>
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>7. Testen</strong>
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
        <div className="dashboard-inline dashboard-wrap">
          <Link href={`/sites/${siteSlug}/embedding`} className="dashboard-button dashboard-button--secondary">
            Test vorbereiten
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

      <section className="dashboard-card dashboard-stack">
        <div className="dashboard-info-row">
          <div>
            <strong>8. Live schalten</strong>
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
          onClick={() =>
            patchSetup({ goLiveAt: new Date().toISOString() }, "Kunde live geschaltet.", "live")
          }
          disabled={!canGoLive || savingKey === "live" || progress.liveDone}
        >
          {savingKey === "live" ? "Speichert..." : progress.liveDone ? "Bereits live" : "Live schalten"}
        </Button>
      </section>
    </div>
  );
}
