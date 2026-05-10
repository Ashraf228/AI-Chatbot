"use client";

import { useEffect, useState } from "react";
import { LeadFilters } from "./LeadFilters";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import { encodeSiteId } from "../../lib/site-id";

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
    <div className="dashboard-card">
      <div className="dashboard-stack dashboard-stack--sm">
        <div className="dashboard-grid dashboard-grid--metrics-4" style={{ gap: 12 }}>
          <LeadMiniMetric label="Anfragen" value={items.length} />
          <LeadMiniMetric label="Neu" value={newCount} />
          <LeadMiniMetric label="Kontaktiert" value={contactedCount} />
          <LeadMiniMetric label="Qualifiziert" value={qualifiedCount} />
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
        <EmptyState title="Keine Anfragen gefunden." />
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                {["Anfrage", "Kunde", "Kontakt", "Status", "Nachricht", "Zeit", "Aktionen"].map((cell) => (
                  <th key={cell} className="dashboard-th">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((lead) => (
                <tr key={lead.id}>
                  <td className="dashboard-td">
                    <strong>{lead.name}</strong>
                  </td>
                  <td className="dashboard-td">{lead.siteName || lead.siteId}</td>
                  <td className="dashboard-td">
                    <div>{lead.email}</div>
                    {lead.phone && <div className="dashboard-copy dashboard-copy--muted">{lead.phone}</div>}
                  </td>
                  <td className="dashboard-td">
                    <div className="dashboard-stack dashboard-stack--sm">
                      <LeadStatusBadge status={lead.status} />
                      <Select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                      >
                        <option value="new">Neu</option>
                        <option value="contacted">Kontaktiert</option>
                        <option value="qualified">Qualifiziert</option>
                        <option value="closed">Abgeschlossen</option>
                      </Select>
                    </div>
                  </td>
                  <td className="dashboard-td">{lead.message || "-"}</td>
                  <td className="dashboard-td">{new Date(lead.createdAt).toLocaleString()}</td>
                  <td className="dashboard-td">
                    <div className="dashboard-stack dashboard-stack--sm">
                      {lead.sessionId ? (
                        <a className="dashboard-link-card" href={`/sites/${encodeSiteId(lead.siteId)}/conversations`}>
                          Chat öffnen
                        </a>
                      ) : null}
                      <Button type="button" variant="secondary" onClick={() => deleteLead(lead.id)}>
                        Löschen
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeadMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-copy--muted" style={{ marginBottom: 0 }}>
        {label}
      </p>
    </div>
  );
}
