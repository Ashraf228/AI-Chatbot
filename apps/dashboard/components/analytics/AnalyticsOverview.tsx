"use client";

import { useEffect, useState } from "react";
import { ActivePagesTable } from "./ActivePagesTable";
import { ConversionChart } from "./ConversionChart";
import { MetricCard } from "./MetricCard";
import { TopQuestionsTable } from "./TopQuestionsTable";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type QuestionMetric = {
  question: string;
  count: number;
};

type PageMetric = {
  pageUrl: string;
  count: number;
};

type AnalyticsSummary = {
  widgetImpressions: number;
  widgetOpenings: number;
  startedChats: number;
  leads: number;
  sentMessages: number;
  fallbackAnswers: number;
  averageConversationDurationSeconds: number;
  estimatedSupportRelief: number;
  leadRate: number;
  aiAnswerRate: number;
  mostActivePages: PageMetric[];
  topQuestions: QuestionMetric[];
};

type AnalyticsOverviewProps = {
  siteId?: string;
  endpoint?: string;
};

export function AnalyticsOverview({
  siteId,
  endpoint = "/api/widget/events/summary",
}: AnalyticsOverviewProps) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Partial<AnalyticsSummary> & {
        message?: string;
      };
      if (!res.ok) {
        setError(json?.message || "Analytics konnten nicht geladen werden.");
        return;
      }
      setData({
        widgetImpressions: Number(json.widgetImpressions || 0),
        widgetOpenings: Number(json.widgetOpenings || 0),
        startedChats: Number(json.startedChats || 0),
        leads: Number(json.leads || 0),
        sentMessages: Number(json.sentMessages || 0),
        fallbackAnswers: Number(json.fallbackAnswers || 0),
        averageConversationDurationSeconds: Number(
          json.averageConversationDurationSeconds || 0
        ),
        estimatedSupportRelief: Number(json.estimatedSupportRelief || 0),
        leadRate: Number(json.leadRate || 0),
        aiAnswerRate: Number(json.aiAnswerRate || 0),
        mostActivePages: Array.isArray(json.mostActivePages) ? json.mostActivePages : [],
        topQuestions: Array.isArray(json.topQuestions) ? json.topQuestions : [],
      });
    }

    load();
  }, [endpoint, siteId]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="dashboard-grid">
      <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
        <MetricCard label="Impressions" value={data.widgetImpressions || 0} />
        <MetricCard label="Openings" value={data.widgetOpenings || 0} />
        <MetricCard label="Chats" value={data.startedChats || 0} />
        <MetricCard label="Leads" value={data.leads || 0} />
      </div>
      <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 16 }}>
        <MetricCard label="Nachrichten" value={data.sentMessages || 0} />
        <MetricCard label="Fallbacks" value={data.fallbackAnswers || 0} />
        <MetricCard
          label="Ø Gesprächsdauer"
          value={`${Number(data.averageConversationDurationSeconds || 0).toFixed(0)} s`}
        />
        <MetricCard label="Support-Entlastung" value={data.estimatedSupportRelief || 0} />
      </div>
      <div className="dashboard-grid dashboard-grid--two" style={{ gap: 16 }}>
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
