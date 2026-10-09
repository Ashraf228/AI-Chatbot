"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { TopQuestionsTable } from "./TopQuestionsTable";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type QuestionMetric = {
  question: string;
  count: number;
};

type OptimizationSummary = {
  fallbackAnswers: number;
  dropOffSessions: number;
  leadRate: number;
  unansweredQuestions: QuestionMetric[];
  recommendations: string[];
};

export function OptimizationOverview({ siteId }: { siteId?: string }) {
  const [data, setData] = useState<OptimizationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`/api/widget/optimization?${params.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Partial<OptimizationSummary> & {
        message?: string;
      };
      if (!res.ok) {
        setError(json?.message || "Verbesserungsdaten konnten nicht geladen werden.");
        return;
      }
      setData({
        fallbackAnswers: Number(json.fallbackAnswers || 0),
        dropOffSessions: Number(json.dropOffSessions || 0),
        leadRate: Number(json.leadRate || 0),
        unansweredQuestions: Array.isArray(json.unansweredQuestions)
          ? json.unansweredQuestions
          : [],
        recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
      });
    }

    load();
  }, [siteId]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;

  return (
    <div className="dashboard-grid">
      <div className="dashboard-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        <MetricCard label="Fallbacks" value={data.fallbackAnswers || 0} />
        <MetricCard label="Abbrüche" value={data.dropOffSessions || 0} />
        <MetricCard label="Anfragequote" value={`${(Number(data.leadRate || 0) * 100).toFixed(1)}%`} />
      </div>
      <TopQuestionsTable items={data.unansweredQuestions || []} title="Unbeantwortete Fragen" />
      <div className="dashboard-card">
        <h3 className="dashboard-card-title dashboard-card-title--sm">Handlungsempfehlungen</h3>
        {(data.recommendations || []).length === 0 ? (
          <div>Keine Empfehlungen vorhanden.</div>
        ) : (
          <ul className="dashboard-list">
            {(data.recommendations || []).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
