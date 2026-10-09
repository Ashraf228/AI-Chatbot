"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type AgentActivityStatus = "success" | "warning" | "error" | "pending";

type AgentActivity = {
  id: string;
  type: string;
  status: AgentActivityStatus;
  label: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

const STATUS_LABELS: Record<AgentActivityStatus, string> = {
  success: "Erfolg",
  warning: "Warnung",
  error: "Fehler",
  pending: "Wartet",
};

export function CustomerAgentActivityTable({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/agent-activity?limit=50`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data?.message || "Automationsprotokoll konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }

    load();
  }, [siteId]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Automationsprotokoll</h2>
        <p className="dashboard-copy">
          Kompakte Übersicht darüber, welche Agenten- und Tool-Aktionen für diesen Kunden passiert sind.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Noch keine Automationsaktivitäten vorhanden." />
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table dashboard-table--wide">
            <thead>
              <tr>
                {["Zeitpunkt", "Aktion", "Status", "Beschreibung"].map((label) => (
                  <th key={label} className="dashboard-th">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.type}:${item.id}`}>
                  <td className="dashboard-td">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="dashboard-td">{item.label}</td>
                  <td className="dashboard-td">
                    <span className={statusClassName(item.status)}>{STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="dashboard-td">{item.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function statusClassName(status: AgentActivityStatus) {
  if (status === "success") {
    return "dashboard-status dashboard-status--success";
  }

  if (status === "error") {
    return "dashboard-status dashboard-status--error";
  }

  return "dashboard-badge";
}
