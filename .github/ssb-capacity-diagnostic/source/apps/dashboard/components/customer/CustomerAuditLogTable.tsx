"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";

type AuditLog = {
  id: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  apply_template: "Vorlage angewendet",
  go_live: "Live geschaltet",
  update_widget_config: "Widget-Einstellungen geändert",
  update_branding: "Design geändert",
  update_behavior: "Verhalten geändert",
  ingest_faq: "FAQ importiert",
  upload_pdf: "PDF hochgeladen",
  update_knowledge_source: "Wissen geändert",
  delete_knowledge_source: "Wissen gelöscht",
  update_site_modules: "Funktionen geändert",
  update_integration: "Verbindung geändert",
  rotate_integration_secrets: "Verbindungs-Secrets rotiert",
  "template.applied": "Vorlage angewendet",
  "site.go_live": "Live geschaltet",
  "leads.exported": "Anfragen exportiert",
  "lead.deleted": "Anfrage gelöscht",
  "conversations.exported": "Chats exportiert",
  "conversation.deleted": "Chat gelöscht",
  "conversations.deleted": "Chats gelöscht",
  "report.deleted": "Bericht gelöscht",
};

export function CustomerAuditLogTable({ siteId }: { siteId: string }) {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/audit-logs?limit=100`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) {
        setError(data?.message || "Audit-Logs konnten nicht geladen werden.");
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
        <h2 className="dashboard-card-title">Audit-Log</h2>
        <p className="dashboard-copy">
          Nachvollziehbare Änderungen und DSGVO-relevante Aktionen für diesen Kunden.
        </p>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Noch keine Audit-Logs vorhanden." />
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table dashboard-table--wide">
            <thead>
              <tr>
                {["Zeit", "Aktion", "Benutzer", "Ressource", "Details"].map((label) => (
                  <th key={label} className="dashboard-th">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="dashboard-td">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="dashboard-td">{ACTION_LABELS[item.action] || item.action}</td>
                  <td className="dashboard-td">
                    <div>{item.actorId || "-"}</div>
                    <div className="dashboard-copy dashboard-copy--muted">{item.actorRole || "-"}</div>
                  </td>
                  <td className="dashboard-td">
                    {item.resourceType}
                    {item.resourceId ? ` · ${item.resourceId}` : ""}
                  </td>
                  <td className="dashboard-td">
                    {item.metadata && Object.keys(item.metadata).length > 0
                      ? JSON.stringify(item.metadata)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
