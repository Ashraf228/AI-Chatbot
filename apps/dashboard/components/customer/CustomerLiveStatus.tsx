"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import {
  mapOverallStatusToTone,
  type CustomerOverallStatus,
} from "./customer-status";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type CustomerLiveStatusProps = {
  siteId: string;
};

type SiteDetails = {
  id: string;
  name: string;
  siteKey: string;
  allowedDomains: string[];
  industry: string;
  setupGoal: string;
  logoUrl: string;
  brandColor: string;
  welcomeMessage: string;
  lastTestedAt: string;
  goLiveAt: string;
};

type EventSummary = {
  startedChats: number;
  leads: number;
  topQuestions: Array<{ question: string; count: number }>;
};

type ConversationRow = {
  last_active_at: string;
};

type ReportRun = {
  createdAt?: string;
  created_at?: string;
};

function formatDate(value: string) {
  if (!value) {
    return "Noch nicht vorhanden";
  }

  return new Date(value).toLocaleString("de-DE");
}

export function CustomerLiveStatus({ siteId }: CustomerLiveStatusProps) {
  const [site, setSite] = useState<SiteDetails | null>(null);
  const [knowledgeCount, setKnowledgeCount] = useState(0);
  const [overallStatus, setOverallStatus] = useState<CustomerOverallStatus>("Setup unvollständig");
  const [eventSummary, setEventSummary] = useState<EventSummary>({
    startedChats: 0,
    leads: 0,
    topQuestions: [],
  });
  const [lastActivity, setLastActivity] = useState("");
  const [lastReport, setLastReport] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [siteRes, statusRes, knowledgeRes, eventRes, conversationsRes, reportsRes] = await Promise.all([
        fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" }),
        fetch(`/api/sites/${siteId}/status`, { cache: "no-store" }),
        fetch(`/api/knowledge?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
        fetch(`/api/widget/events/summary?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
        fetch(`/api/conversations?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
        fetch(`/api/widget/reports/history?siteId=${encodeURIComponent(siteId)}`, { cache: "no-store" }),
      ]);

      const [siteData, statusData, knowledgeData, eventData, conversationsData, reportsData] = await Promise.all([
        siteRes.json().catch(() => ({})),
        statusRes.json().catch(() => ({})),
        knowledgeRes.json().catch(() => []),
        eventRes.json().catch(() => ({})),
        conversationsRes.json().catch(() => []),
        reportsRes.json().catch(() => []),
      ]);

      if (!siteRes.ok) {
        setError(siteData?.message || "Kundenstatus konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setSite({
        id: siteData.id || siteId,
        name: siteData.name || siteId,
        siteKey: siteData.siteKey || "",
        allowedDomains: Array.isArray(siteData.allowedDomains) ? siteData.allowedDomains : [],
        industry: siteData.industry || "",
        setupGoal: siteData.setupGoal || "",
        logoUrl: siteData.logoUrl || "",
        brandColor: siteData.brandColor || "#b55400",
        welcomeMessage: siteData.welcomeMessage || "",
        lastTestedAt: siteData.lastTestedAt || "",
        goLiveAt: siteData.goLiveAt || "",
      });
      setKnowledgeCount(Array.isArray(knowledgeData) ? knowledgeData.length : 0);
      if (statusRes.ok && statusData?.status) {
        setOverallStatus(statusData.status);
      }
      setEventSummary({
        startedChats: Number(eventData?.startedChats || 0),
        leads: Number(eventData?.leads || 0),
        topQuestions: Array.isArray(eventData?.topQuestions) ? eventData.topQuestions.slice(0, 3) : [],
      });

      const conversations = Array.isArray(conversationsData) ? (conversationsData as ConversationRow[]) : [];
      const latestConversation = conversations
        .map((item) => item.last_active_at)
        .filter(Boolean)
        .sort()
        .at(-1);
      setLastActivity(latestConversation || "");

      const reports = Array.isArray(reportsData) ? (reportsData as ReportRun[]) : [];
      const latestReport = reports
        .map((item) => item.createdAt || item.created_at || "")
        .filter(Boolean)
        .sort()
        .at(-1);
      setLastReport(latestReport || "");
      setLoading(false);
    }

    load();
  }, [siteId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error || !site) {
    return <ErrorState message={error || "Kundenstatus konnte nicht geladen werden."} />;
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
        <div>
          <h2 className="dashboard-card-title">Kundenstatus</h2>
          <p className="dashboard-copy">
            Einrichtung, Live-Status und die wichtigsten Betriebsdaten auf einen Blick.
          </p>
        </div>
        <CustomerStatusBadge
          status={mapOverallStatusToTone(overallStatus)}
          label={overallStatus}
        />
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
        <div className="dashboard-card dashboard-card--soft">
          <strong>{site.goLiveAt ? "Live" : "Noch nicht live"}</strong>
          <p className="dashboard-copy dashboard-copy--muted">Widget-Status</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>{eventSummary.leads}</strong>
          <p className="dashboard-copy dashboard-copy--muted">Neue Anfragen</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>{eventSummary.startedChats}</strong>
          <p className="dashboard-copy dashboard-copy--muted">Chats bisher</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>{knowledgeCount}</strong>
          <p className="dashboard-copy dashboard-copy--muted">Wissensinhalte</p>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 16 }}>
        <div className="dashboard-card dashboard-card--soft">
          <strong>Letzte Aktivität</strong>
          <p className="dashboard-copy dashboard-copy--muted">{formatDate(lastActivity)}</p>
        </div>
        <div className="dashboard-card dashboard-card--soft">
          <strong>Letzter Bericht</strong>
          <p className="dashboard-copy dashboard-copy--muted">{formatDate(lastReport)}</p>
        </div>
      </div>

      <div className="dashboard-card dashboard-card--soft">
        <strong>Top-Fragen</strong>
        {eventSummary.topQuestions.length === 0 ? (
          <p className="dashboard-copy dashboard-copy--muted">Noch keine häufigen Fragen vorhanden.</p>
        ) : (
          <div className="dashboard-stack dashboard-stack--sm" style={{ marginTop: 10 }}>
            {eventSummary.topQuestions.map((item) => (
              <div key={item.question} className="dashboard-info-row">
                <span>{item.question}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
