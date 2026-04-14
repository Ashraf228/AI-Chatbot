"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ActivePagesTable } from "./ActivePagesTable";
import { ConversionChart } from "./ConversionChart";
import { MetricCard } from "./MetricCard";
import { TopQuestionsTable } from "./TopQuestionsTable";

type AnalyticsOverviewProps = {
  siteId?: string;
  endpoint?: string;
};

export function AnalyticsOverview({
  siteId,
  endpoint = "/api/widget/events/summary",
}: AnalyticsOverviewProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || "Analytics konnten nicht geladen werden.");
        return;
      }
      setData(json);
    }

    load();
  }, [endpoint, siteId]);

  if (error) return <div style={{ color: "#b91c1c" }}>{error}</div>;
  if (!data) return <div style={panelStyle}>Analytics werden geladen...</div>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <MetricCard label="Impressions" value={data.widgetImpressions || 0} />
        <MetricCard label="Openings" value={data.widgetOpenings || 0} />
        <MetricCard label="Chats" value={data.startedChats || 0} />
        <MetricCard label="Leads" value={data.leads || 0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <MetricCard label="Nachrichten" value={data.sentMessages || 0} />
        <MetricCard label="Fallbacks" value={data.fallbackAnswers || 0} />
        <MetricCard
          label="Ø Gesprächsdauer"
          value={`${Number(data.averageConversationDurationSeconds || 0).toFixed(0)} s`}
        />
        <MetricCard label="Support-Entlastung" value={data.estimatedSupportRelief || 0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <ConversionChart
          leadRate={Number(data.leadRate || 0)}
          aiAnswerRate={Number(data.aiAnswerRate || 0)}
        />
        <ActivePagesTable items={data.mostActivePages || []} />
      </div>
      <TopQuestionsTable items={data.topQuestions || []} />
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};
