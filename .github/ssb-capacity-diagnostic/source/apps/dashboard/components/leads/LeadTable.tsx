"use client";

import { useEffect, useState } from "react";
import { LeadFilters } from "./LeadFilters";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LeadDeliveryBadge } from "./LeadDeliveryBadge";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import { encodeSiteId } from "../../lib/site-id";
import { CompactMetricCard } from "../shared/CompactMetricCard";
import { EmptyStateCard } from "../shared/EmptyStateCard";

type LeadTableProps = {
  siteId?: string;
};

type LeadRow = {
  id: string;
  siteId: string;
  siteName: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  sessionId?: string;
  status: string;
  createdAt: string;
  delivery?: {
    stored?: boolean;
    email?: "not_configured" | "pending" | "sent" | "failed" | "unknown";
    webhook?: "not_configured" | "pending" | "sent" | "failed" | "unknown";
    emailAttempts?: number | null;
    webhookAttempts?: number | null;
    emailUpdatedAt?: string | null;
    webhookUpdatedAt?: string | null;
  };
};

export function LeadTable({ siteId }: LeadTableProps) {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    if (status) params.set("status", status);
    const res = await fetch(`/api/widget/leads?${params.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      setError(data?.message || "Anfragen konnten nicht geladen werden.");
      setLoading(false);
      return;
    }
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [siteId, status]);

  async function updateStatus(id: string, nextStatus: string) {
    await fetch(`/api/widget/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    load();
  }

  async function deleteLead(id: string) {
    const confirmed = window.confirm("Diese Anfrage wirklich löschen?");
    if (!confirmed) {
      return;
    }

    const res = await fetch(`/api/widget/leads/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.message || "Anfrage konnte nicht gelöscht werden.");
      return;
    }
    load();
  }

  function exportLeads() {
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    if (status) params.set("status", status);
    window.location.href = `/api/widget/leads/export?${params.toString()}`;
  }

  const filteredItems = items.filter((lead) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [lead.name, lead.email, lead.phone || "", lead.message || "", lead.siteName || lead.siteId]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const newCount = items.filter((lead) => lead.status === "new").length;
  const contactedCount = items.filter((lead) => lead.status === "contacted").length;
  const qualifiedCount = items.filter((lead) => lead.status === "qualified").length;

  return (
    <div className="dashboard-card dashboard-card--compact">
      <div className="dashboard-stack dashboard-stack--sm">
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 12 }}>
          <CompactMetricCard label="Anfragen" value={items.length} />
          <CompactMetricCard label="Neu" value={newCount} />
          <CompactMetricCard label="Kontaktiert" value={contactedCount} />
          <CompactMetricCard label="Qualifiziert" value={qualifiedCount} />
        </div>
        <div className="dashboard-grid dashboard-grid--two" style={{ gap: 12 }}>
          <LeadFilters status={status} onStatusChange={setStatus} />
          <label className="dashboard-field">
            <span className="dashboard-field-label">Suche</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, Kontakt, Interesse"
            />
          </label>
        </div>
        <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
          <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
            Quelle: Widget Chat. Status kann hier ohne CRM-Logik gepflegt werden.
          </p>
          <Button type="button" variant="secondary" onClick={exportLeads}>
            Anfragen exportieren
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : filteredItems.length === 0 ? (
        <EmptyStateCard title={siteId ? "Noch keine Anfragen für diesen Kunden" : "Keine Anfragen gefunden"} />
      ) : (
        <div className="lead-compact-list">
          {filteredItems.map((lead) => (
            <article key={lead.id} className="lead-compact-row">
              <div>
                <strong>{lead.name || "Unbekannter Kontakt"}</strong>
                <p className="dashboard-copy dashboard-copy--muted">
                  {[lead.email, lead.phone].filter(Boolean).join(" · ") || "Keine Kontaktmöglichkeit hinterlegt"}
                </p>
              </div>
              <div>
                <strong>{lead.siteName || lead.siteId}</strong>
                <p className="dashboard-copy dashboard-copy--muted">
                  {lead.message || "Kein Anliegen hinterlegt"}
                </p>
              </div>
              <div className="dashboard-stack dashboard-stack--sm">
                <LeadStatusBadge status={lead.status} />
                <LeadDeliveryBadge delivery={lead.delivery} />
                <Select value={lead.status} onChange={(e) => updateStatus(lead.id, e.target.value)}>
                  <option value="new">Neu</option>
                  <option value="contacted">Kontaktiert</option>
                  <option value="qualified">Qualifiziert</option>
                  <option value="closed">Abgeschlossen</option>
                </Select>
              </div>
              <div>
                <p className="dashboard-copy dashboard-copy--muted">{new Date(lead.createdAt).toLocaleString("de-DE")}</p>
                <div className="dashboard-inline dashboard-wrap">
                  {lead.sessionId ? (
                    <a className="dashboard-link-card" href={`/sites/${encodeSiteId(lead.siteId)}/conversations`}>
                      Chat öffnen
                    </a>
                  ) : null}
                  <Button type="button" variant="secondary" onClick={() => deleteLead(lead.id)}>
                    Löschen
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
