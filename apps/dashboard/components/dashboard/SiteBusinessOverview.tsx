"use client";

import { useEffect, useState } from "react";
import { BusinessMetricCard } from "./BusinessMetricCard";
import { QuestionList, RecentConversations, RecentLeads, RecommendedActions } from "./BusinessLists";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import type { BusinessSummary } from "../../lib/business-analytics";
import { formatNumber, formatPercent } from "../../lib/business-analytics";

export function SiteBusinessOverview({ siteId }: { siteId: string }) {
  const [data, setData] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/analytics/summary`, { cache: "no-store" });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(json?.message || "Kundenübersicht konnte nicht geladen werden.");
        return;
      }
      setData(json as BusinessSummary);
    }
    load();
  }, [siteId]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Business Performance</h2>
        <p className="dashboard-copy">Die wichtigsten Betriebszahlen dieses Kunden auf einen Blick.</p>
      </div>
      <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 12 }}>
        <BusinessMetricCard label="Chats heute" value={formatNumber(data.conversationsToday)} />
        <BusinessMetricCard label="Chats 7 Tage" value={formatNumber(data.conversations7d)} />
        <BusinessMetricCard label="Anfragen 7 Tage" value={formatNumber(data.leads7d)} />
        <BusinessMetricCard label="Conversion" value={formatPercent(data.conversionRate)} />
      </div>
      {data.knowledge ? (
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 12 }}>
          <BusinessMetricCard label="Wissen bereit" value={formatNumber(data.knowledge.activeReady)} />
          <BusinessMetricCard label="Wissen in Verarbeitung" value={formatNumber(data.knowledge.processing)} />
          <BusinessMetricCard label="Wissen fehlerhaft" value={formatNumber(data.knowledge.failed)} />
          <BusinessMetricCard label="Antworten mit Wissen" value={formatPercent(data.knowledgeHitRate)} />
        </div>
      ) : null}
      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 14 }}>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Häufige Fragen</h3>
          <QuestionList items={data.topQuestions || []} emptyLabel="Noch keine häufigen Fragen vorhanden." />
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Offene Fragen</h3>
          <QuestionList items={data.unansweredQuestions || []} emptyLabel="Keine offenen Fragen erkannt." />
        </div>
      </div>
      <RecommendedActions items={data.recommendedActions || []} />
      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 14 }}>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Letzte Gespräche</h3>
          <RecentConversations items={data.recentConversations || []} />
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Letzte Anfragen</h3>
          <RecentLeads items={data.recentLeads || []} />
        </div>
      </div>
    </section>
  );
}
