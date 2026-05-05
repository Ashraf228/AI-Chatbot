"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Topbar } from "../components/layout/Topbar";
import { ErrorState } from "../components/shared/ErrorState";
import { Input } from "../components/shared/Input";
import { LoadingState } from "../components/shared/LoadingState";
import { Select } from "../components/shared/Select";

const cards = [
  {
    href: "/sites",
    title: "Kunden",
    description: "Kunden anlegen, Domains pflegen und Einbindungen vorbereiten.",
  },
  {
    href: "/leads",
    title: "Anfragen",
    description: "Neue Kontakte prüfen, sortieren und weiterbearbeiten.",
  },
  {
    href: "/conversations",
    title: "Chats",
    description: "Verläufe prüfen, Nachrichten lesen und Auffälligkeiten erkennen.",
  },
  {
    href: "/reports",
    title: "Berichte",
    description: "Report-Historie prüfen und Auswertungen für laufende Kunden einsehen.",
  },
];

type WidgetSummary = {
  startedChats: number;
  leads: number;
};

type AgentSummary = {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  processingRuns: number;
  recentRuns: Array<{
    id: string;
    siteId: string;
    siteName: string;
    siteKey: string;
    agentLabel: string;
    status: string;
    inputSummary: string | null;
    outputSummary: string | null;
    createdAt: string;
  }>;
};

function statusTone(status: string) {
  switch (status) {
    case "completed":
      return "dashboard-status dashboard-status--success";
    case "failed":
      return "dashboard-status dashboard-status--error";
    default:
      return "dashboard-badge";
  }
}

export default function DashboardHomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [widgetSummary, setWidgetSummary] = useState<WidgetSummary>({ startedChats: 0, leads: 0 });
  const [showAutomationOverview, setShowAutomationOverview] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState("all");
  const [runSearch, setRunSearch] = useState("");
  const [agentSummary, setAgentSummary] = useState<AgentSummary>({
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    processingRuns: 0,
    recentRuns: [],
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [widgetRes, agentRes] = await Promise.all([
        fetch("/api/widget/events/summary", { cache: "no-store" }),
        fetch("/api/agents/summary", { cache: "no-store" }),
      ]);

      const widgetData = await widgetRes.json().catch(() => ({}));
      const agentData = await agentRes.json().catch(() => ({}));

      if (!widgetRes.ok) {
        setError(widgetData?.message || "Widget-Zusammenfassung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      if (!agentRes.ok) {
        setError(agentData?.message || "Agenten-Zusammenfassung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setWidgetSummary({
        startedChats: Number(widgetData?.startedChats || 0),
        leads: Number(widgetData?.leads || 0),
      });

      setAgentSummary({
        totalRuns: Number(agentData?.totalRuns || 0),
        completedRuns: Number(agentData?.completedRuns || 0),
        failedRuns: Number(agentData?.failedRuns || 0),
        processingRuns: Number(agentData?.processingRuns || 0),
        recentRuns: Array.isArray(agentData?.recentRuns) ? agentData.recentRuns : [],
      });

      setLoading(false);
    }

    load();
  }, []);

  const filteredRecentRuns = agentSummary.recentRuns.filter((run) => {
    if (runStatusFilter !== "all" && run.status !== runStatusFilter) {
      return false;
    }

    const search = runSearch.trim().toLowerCase();
    if (!search) {
      return true;
    }

    return [run.agentLabel, run.siteName, run.inputSummary || "", run.outputSummary || ""]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  if (loading) {
    return (
      <div>
        <Topbar title="Heute" />
        <div className="dashboard-page">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Topbar title="Heute" />
        <div className="dashboard-page">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Heute" />
      <div className="dashboard-page dashboard-stack">
        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 16 }}>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{widgetSummary.startedChats}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Gestartete Chats</p>
          </div>
          <div className="dashboard-card dashboard-card--soft">
            <strong>{widgetSummary.leads}</strong>
            <p className="dashboard-copy dashboard-copy--muted">Anfragen</p>
          </div>
        </div>

        <div className="dashboard-grid dashboard-grid--split" style={{ gap: 18 }}>
          <div className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Schnellstart</h2>
              <p className="dashboard-copy">
                Die wichtigsten Bereiche für die tägliche Arbeit und neue Kunden.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 18,
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              }}
            >
              {cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                  }}
                  className="dashboard-card dashboard-card--soft"
                >
                  <h3 className="dashboard-card-title dashboard-card-title--sm">{card.title}</h3>
                  <p className="dashboard-copy" style={{ marginBottom: 0 }}>
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Erweiterte Automationsübersicht</h2>
              <p className="dashboard-copy">
                Für technische Rückfragen und spätere Diagnosefälle. Im normalen Tagesgeschäft wird
                dieser Bereich seltener benötigt.
              </p>
            </div>

            <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
              <button
                type="button"
                className="dashboard-button dashboard-button--secondary"
                onClick={() => setShowAutomationOverview((current) => !current)}
              >
                {showAutomationOverview ? "Automationsübersicht ausblenden" : "Automationsübersicht anzeigen"}
              </button>
            </div>

            {showAutomationOverview ? (
              <>
                <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
                  <div className="dashboard-card dashboard-card--soft">
                    <strong>{agentSummary.totalRuns}</strong>
                    <p className="dashboard-copy dashboard-copy--muted">Automationen gesamt</p>
                  </div>
                  <div className="dashboard-card dashboard-card--soft">
                    <strong>{agentSummary.completedRuns}</strong>
                    <p className="dashboard-copy dashboard-copy--muted">Erfolgreich</p>
                  </div>
                  <div className="dashboard-card dashboard-card--soft">
                    <strong>{agentSummary.failedRuns}</strong>
                    <p className="dashboard-copy dashboard-copy--muted">Fehlgeschlagen</p>
                  </div>
                  <div className="dashboard-card dashboard-card--soft">
                    <strong>{agentSummary.processingRuns}</strong>
                    <p className="dashboard-copy dashboard-copy--muted">In Bearbeitung</p>
                  </div>
                </div>

                <div className="dashboard-grid dashboard-grid--two" style={{ gap: 12 }}>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Status filtern</span>
                    <Select value={runStatusFilter} onChange={(event) => setRunStatusFilter(event.target.value)}>
                      <option value="all">Alle</option>
                      <option value="completed">Abgeschlossen</option>
                      <option value="failed">Fehlgeschlagen</option>
                      <option value="processing">In Bearbeitung</option>
                      <option value="queued">Queued</option>
                    </Select>
                  </label>
                  <label className="dashboard-field">
                    <span className="dashboard-field-label">Suche</span>
                    <Input
                      placeholder="Automation, Kunde, Eingabe"
                      value={runSearch}
                      onChange={(event) => setRunSearch(event.target.value)}
                    />
                  </label>
                </div>

                {filteredRecentRuns.length === 0 ? (
                  <p className="dashboard-copy dashboard-copy--muted">Noch keine Automationen vorhanden.</p>
                ) : (
                  <div className="dashboard-stack dashboard-stack--sm">
                    {filteredRecentRuns.map((run) => (
                      <Link
                        key={run.id}
                        href={`/sites/${encodeURIComponent(run.siteId)}/agents`}
                        className="dashboard-card dashboard-card--soft"
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <div className="dashboard-info-row">
                          <strong>{run.agentLabel}</strong>
                          <span className={statusTone(run.status)}>{run.status}</span>
                        </div>
                        <div className="dashboard-copy dashboard-copy--muted">
                          {run.siteName} · {new Date(run.createdAt).toLocaleString("de-DE")}
                        </div>
                        {run.inputSummary ? (
                          <div className="dashboard-copy">
                            <strong>Eingabe:</strong> {run.inputSummary}
                          </div>
                        ) : null}
                        {run.outputSummary ? (
                          <div className="dashboard-copy">
                            <strong>Ergebnis:</strong> {run.outputSummary}
                          </div>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="dashboard-copy dashboard-copy--muted">
                Eingeklappt, damit der Fokus auf Kundenanlage, Anfragen und Betrieb liegt.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
