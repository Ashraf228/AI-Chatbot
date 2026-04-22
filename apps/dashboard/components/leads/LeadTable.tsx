"use client";

import { useEffect, useState } from "react";
import { LeadFilters } from "./LeadFilters";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

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
  status: string;
  createdAt: string;
};

export function LeadTable({ siteId }: LeadTableProps) {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    if (status) params.set("status", status);
    const res = await fetch(`/api/widget/leads?${params.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      setError(data?.message || "Leads konnten nicht geladen werden.");
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

  return (
    <div className="dashboard-card">
      <LeadFilters status={status} onStatusChange={setStatus} />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState title="Keine Leads gefunden." />
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                {["Lead", "Site", "Kontakt", "Status", "Nachricht", "Zeit"].map((cell) => (
                  <th key={cell} className="dashboard-th">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
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
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="qualified">qualified</option>
                        <option value="lost">lost</option>
                      </Select>
                    </div>
                  </td>
                  <td className="dashboard-td">{lead.message || "-"}</td>
                  <td className="dashboard-td">{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
