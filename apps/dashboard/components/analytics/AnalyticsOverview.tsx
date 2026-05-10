"use client";

import { useEffect, useState } from "react";
import { BusinessMetricCard } from "../dashboard/BusinessMetricCard";
import { QuestionList, RecentConversations, RecentLeads, RecommendedActions } from "../dashboard/BusinessLists";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import type { BusinessSummary } from "../../lib/business-analytics";
import { formatMinutes, formatNumber, formatPercent } from "../../lib/business-analytics";

type AnalyticsOverviewProps = {
  siteId?: string;
  endpoint?: string;
};

function sparklineLabel(points: Array<{ date: string; count: number }>) {
  if (points.length === 0) {
    return "Keine Daten";
  }
  return points.map((point) => `${new Date(point.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}: ${point.count}`).join(" · ");
}

export function AnalyticsOverview({
  siteId,
  endpoint,
}: AnalyticsOverviewProps) {
  const [data, setData] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);
      const target = endpoint || (siteId ? `/api/sites/${encodeURIComponent(siteId)}/analytics/summary` : "/api/dashboard/summary");
      const response = await fetch(target, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.message || "Analytics konnten nicht geladen werden.");
        return;
      }
      setData(json as BusinessSummary);
    }
    load();
  }, [endpoint, siteId]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Business Analytics</h2>
          <p className="dashboard-copy">
            Fokus auf Gespräche, Anfragen, Wissensnutzung und operative Qualität der KI.
          </p>
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
          <BusinessMetricCard label="Gespräche heute" value={formatNumber(data.conversationsToday)} />
          <BusinessMetricCard label="Gespräche 7 Tage" value={formatNumber(data.conversations7d)} />
          <BusinessMetricCard label="Anfragen 7 Tage" value={formatNumber(data.leads7d)} />
          <BusinessMetricCard label="Conversion Rate" value={formatPercent(data.conversionRate)} />
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
          <BusinessMetricCard label="Handoff Rate" value={formatPercent(data.handoffRate)} />
          <BusinessMetricCard label="Knowledge-Hit-Rate" value={formatPercent(data.knowledgeHitRate)} />
          <BusinessMetricCard label="Tool-Aktionen" value={formatNumber(data.toolExecutionCount)} />
          <BusinessMetricCard label="Ø Antwortzeit" value={`${formatNumber(data.averageResponseTimeMs)} ms`} />
        </div>
        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 16 }}>
          <BusinessMetricCard
            label="Geschätzte Supportzeit gespart"
            value={formatMinutes(data.estimatedSupportTimeSavedMinutes)}
            hint={`${data.supportTimeAssumptionMinutes} Minuten Standardannahme pro Gespräch`}
          />
          <BusinessMetricCard label="Offene Handoffs/Tickets" value={formatNumber(data.openHandoffsOrTickets)} />
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 18 }}>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Gespräche Verlauf</h2>
          <p className="dashboard-copy dashboard-copy--muted">{sparklineLabel(data.conversationsOverTime || [])}</p>
        </section>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Anfragen Verlauf</h2>
          <p className="dashboard-copy dashboard-copy--muted">{sparklineLabel(data.leadsOverTime || [])}</p>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 18 }}>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Häufige Fragen</h2>
          <QuestionList items={data.topQuestions || []} emptyLabel="Noch keine häufigen Fragen vorhanden." />
        </section>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Unbeantwortete Fragen</h2>
          <QuestionList items={data.unansweredQuestions || []} emptyLabel="Keine offenen Fragen erkannt." />
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 18 }}>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Letzte Gespräche</h2>
          <RecentConversations items={data.recentConversations || []} />
        </section>
        <section className="dashboard-card dashboard-stack">
          <h2 className="dashboard-card-title">Letzte Anfragen</h2>
          <RecentLeads items={data.recentLeads || []} />
        </section>
      </div>

      <section className="dashboard-card dashboard-stack">
        <h2 className="dashboard-card-title">Empfohlene Optimierungen</h2>
        <RecommendedActions items={data.recommendedActions || []} />
      </section>
    </div>
  );
}
