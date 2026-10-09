"use client";

import { useEffect, useState } from "react";
import { ReportSubscriptionForm } from "./ReportSubscriptionForm";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { Button } from "../shared/Button";

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
    load();
  }, [siteId]);

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

  async function deleteReportRun(id: string) {
    const confirmed = window.confirm("Diesen Bericht wirklich löschen?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/widget/reports/history/${id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data?.message || "Bericht konnte nicht gelöscht werden.");
      return;
    }

    await load();
  }

  return (
    <div className="dashboard-grid">
      <ReportSubscriptionForm siteId={siteId} />

      <div className="dashboard-card">
        <h2 className="dashboard-card-title">Report-Historie</h2>
        {error ? (
          <ErrorState message={error} />
        ) : runs.length === 0 ? (
          <EmptyState title="Noch keine Report-Läufe vorhanden." />
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table dashboard-table--wide">
              <thead>
                <tr>
                  {["Zeit", "Site", "Frequenz", "Status", "Empfänger", "Betreff", "Aktionen"].map((label) => (
                    <th key={label} className="dashboard-th">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="dashboard-td">{new Date(run.createdAt).toLocaleString()}</td>
                    <td className="dashboard-td">{run.siteName || run.siteId || "-"}</td>
                    <td className="dashboard-td">
                      {run.frequency} · {run.triggerSource}
                    </td>
                    <td className="dashboard-td">{run.status}</td>
                    <td className="dashboard-td">{run.recipientEmail || "-"}</td>
                    <td className="dashboard-td">
                      <div>{run.reportSubject || "-"}</div>
                      {run.errorMessage && (
                        <div className="dashboard-status dashboard-status--error" style={{ marginTop: 4 }}>
                          {run.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="dashboard-td">
                      <Button type="button" variant="secondary" onClick={() => deleteReportRun(run.id)}>
                        Löschen
                      </Button>
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
