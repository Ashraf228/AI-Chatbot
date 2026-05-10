"use client";

import { useEffect, useState } from "react";

type SiteUsage = {
  periodStart: string;
  periodEnd: string;
  messages: number;
  conversations: number;
  leads: number;
  toolExecutions: number;
  knowledgeSources: number;
  integrations: number;
};

export function SiteUsagePanel({ siteId }: { siteId: string }) {
  const [usage, setUsage] = useState<SiteUsage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/usage`, { cache: "no-store" });
      const json = (await response.json().catch(() => ({}))) as SiteUsage & { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Nutzung konnte nicht geladen werden.");
      }
      if (!cancelled) setUsage(json);
    }
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Nutzung konnte nicht geladen werden.");
    });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  if (error) return <p className="dashboard-error">{error}</p>;
  if (!usage) return <p className="dashboard-loading">Nutzung wird geladen...</p>;

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <p className="dashboard-eyebrow">Aktueller Monat</p>
        <h2 className="dashboard-card-title">Nutzung dieses Kunden</h2>
        <p className="dashboard-copy dashboard-copy--muted">
          Zeitraum: {formatDate(usage.periodStart)} bis {formatDate(usage.periodEnd)}
        </p>
      </div>
      <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
        <Metric label="Nachrichten" value={usage.messages} />
        <Metric label="Chats" value={usage.conversations} />
        <Metric label="Anfragen" value={usage.leads} />
        <Metric label="Aktionen" value={usage.toolExecutions} />
        <Metric label="Wissensquellen" value={usage.knowledgeSources} />
        <Metric label="Verbindungen" value={usage.integrations} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-metric-card">
      <div className="dashboard-metric-label">{label}</div>
      <strong className="dashboard-metric-value">{new Intl.NumberFormat("de-DE").format(value || 0)}</strong>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}
