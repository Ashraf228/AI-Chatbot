"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ReportSubscriptionForm } from "./ReportSubscriptionForm";

type ReportHistoryTableProps = {
  siteId?: string;
};

type ReportRun = {
  id: string;
  siteId?: string;
  siteName?: string;
  frequency: string;
  triggerSource: string;
  status: string;
  recipientEmail?: string;
  reportSubject?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
};

export function ReportHistoryTable({ siteId }: ReportHistoryTableProps) {
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      const res = await fetch(`/api/widget/reports/history?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        setError(data?.message || "Report-Historie konnte nicht geladen werden.");
        return;
      }
      setRuns(Array.isArray(data) ? data : []);
    }

    load();
  }, [siteId]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <ReportSubscriptionForm siteId={siteId} />

      <div style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Report-Historie</h2>
        {error ? (
          <div style={{ color: "#b91c1c" }}>{error}</div>
        ) : runs.length === 0 ? (
          <div>Noch keine Report-Läufe vorhanden.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  {["Zeit", "Site", "Frequenz", "Status", "Empfänger", "Betreff"].map((label) => (
                    <th key={label} style={thStyle}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td style={tdStyle}>{new Date(run.createdAt).toLocaleString()}</td>
                    <td style={tdStyle}>{run.siteName || run.siteId || "-"}</td>
                    <td style={tdStyle}>
                      {run.frequency} · {run.triggerSource}
                    </td>
                    <td style={tdStyle}>{run.status}</td>
                    <td style={tdStyle}>{run.recipientEmail || "-"}</td>
                    <td style={tdStyle}>
                      <div>{run.reportSubject || "-"}</div>
                      {run.errorMessage && (
                        <div style={{ color: "#b91c1c", marginTop: 4 }}>{run.errorMessage}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: CSSProperties = {
  padding: "12px 8px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};
