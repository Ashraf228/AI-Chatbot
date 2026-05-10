"use client";

import { useEffect, useState } from "react";
import { UsageLimitCards } from "./UsageLimitCards";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { getStatusLabel } from "../../lib/labels";

type BillingPlan = {
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number | null;
  currency: string;
  features: Record<string, boolean>;
};

type Subscription = {
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
};

type UsageSummary = {
  periodStart: string;
  periodEnd: string;
  messages: number;
  conversations: number;
  leads: number;
  toolExecutions: number;
  knowledgeSources: number;
  integrations: number;
  sites: number;
};

type LimitsResponse = {
  plan: BillingPlan | null;
  subscription: Subscription | null;
  checks: Array<{
    key: string;
    limit: number | null;
    used: number;
    remaining: number | null;
    allowed: boolean;
  }>;
  features: Record<string, boolean>;
};

export function BillingOverview() {
  const [limits, setLimits] = useState<LimitsResponse | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      const [limitsRes, usageRes] = await Promise.all([
        fetch("/api/billing/limits", { cache: "no-store" }),
        fetch("/api/billing/usage", { cache: "no-store" }),
      ]);
      const [limitsJson, usageJson] = await Promise.all([
        parseJson<LimitsResponse>(limitsRes),
        parseJson<UsageSummary>(usageRes),
      ]);
      if (!limitsRes.ok || !usageRes.ok) {
        throw new Error(readError(limitsJson) || readError(usageJson) || "Plan- und Nutzungsdaten konnten nicht geladen werden.");
      }
      if (!cancelled) {
        setLimits(limitsJson);
        setUsage(usageJson);
      }
    }
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Plan- und Nutzungsdaten konnten nicht geladen werden.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!limits || !usage) {
    return <LoadingState label="Plan und Nutzung werden geladen..." />;
  }

  const plan = limits.plan;
  const price = plan?.monthlyPriceCents === null || plan?.monthlyPriceCents === undefined
    ? "Individuell"
    : `${new Intl.NumberFormat("de-DE", { style: "currency", currency: plan.currency || "EUR" }).format(plan.monthlyPriceCents / 100)} / Monat`;

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div>
          <p className="dashboard-eyebrow">Plan</p>
          <h2 className="dashboard-card-title">{plan?.name || "Kein Plan"}</h2>
          <p className="dashboard-copy">{plan?.description || "Für diesen Mandanten ist noch kein Plan hinterlegt."}</p>
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
          <Metric label="Status" value={getStatusLabel(limits.subscription?.status || "unknown") || "Unbekannt"} />
          <Metric label="Preis" value={price} />
          <Metric label="Zeitraum ab" value={formatDate(usage.periodStart)} />
          <Metric label="Zeitraum bis" value={formatDate(usage.periodEnd)} />
        </div>
      </section>

      <section className="dashboard-card dashboard-stack">
        <div>
          <p className="dashboard-eyebrow">Verbrauch</p>
          <h2 className="dashboard-card-title">Monatliche Nutzung</h2>
        </div>
        <UsageLimitCards checks={limits.checks || []} />
      </section>

      <section className="dashboard-card dashboard-stack">
        <div>
          <p className="dashboard-eyebrow">Funktionen</p>
          <h2 className="dashboard-card-title">Freigeschaltete Paketfunktionen</h2>
        </div>
        <div className="dashboard-inline dashboard-wrap">
          {Object.entries(limits.features || {}).map(([key, enabled]) => (
            <span key={key} className={enabled ? "dashboard-status dashboard-status--success" : "dashboard-badge"}>
              {featureLabel(key)}: {enabled ? "aktiv" : "inaktiv"}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-label">{label}</div>
      <strong className="dashboard-metric-value">{value}</strong>
    </div>
  );
}

async function parseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function readError(data: unknown) {
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return "";
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}

function featureLabel(key: string) {
  const labels: Record<string, string> = {
    customBranding: "Eigenes Branding",
    whiteLabel: "White Label",
    strictKnowledgeMode: "Striktes Wissen",
    privacyExport: "DSGVO Export",
    prioritySupport: "Priorisierter Support",
    customLimits: "Individuelle Limits",
  };
  return labels[key] || key;
}
