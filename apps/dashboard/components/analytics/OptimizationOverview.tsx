"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { MetricCard } from "./MetricCard";
import { TopQuestionsTable } from "./TopQuestionsTable";

export function OptimizationOverview({ siteId }: { siteId?: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`/api/widget/optimization?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || "Optimization-Daten konnten nicht geladen werden.");
        return;
      }
      setData(json);
    }

    load();
  }, [siteId]);

  if (error) return <div style={{ color: "#b91c1c" }}>{error}</div>;
  if (!data) return <div style={panelStyle}>Optimization-Daten werden geladen...</div>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
        <MetricCard label="Fallbacks" value={data.fallbackAnswers || 0} />
        <MetricCard label="Drop-offs" value={data.dropOffSessions || 0} />
        <MetricCard label="Lead-Rate" value={`${(Number(data.leadRate || 0) * 100).toFixed(1)}%`} />
      </div>
      <TopQuestionsTable items={data.unansweredQuestions || []} title="Unbeantwortete Fragen" />
      <div style={panelStyle}>
        <h3 style={{ marginTop: 0 }}>Handlungsempfehlungen</h3>
        {(data.recommendations || []).length === 0 ? (
          <div>Keine Empfehlungen vorhanden.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {(data.recommendations || []).map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};
