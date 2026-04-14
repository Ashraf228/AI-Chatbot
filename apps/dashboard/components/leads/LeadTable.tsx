"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LeadFilters } from "./LeadFilters";
import { LeadStatusBadge } from "./LeadStatusBadge";

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
    <div style={panelStyle}>
      <LeadFilters status={status} onStatusChange={setStatus} />

      {loading ? (
        <div>Leads werden geladen...</div>
      ) : error ? (
        <div style={{ color: "#b91c1c" }}>{error}</div>
      ) : items.length === 0 ? (
        <div>Keine Leads gefunden.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr>
                {["Lead", "Site", "Kontakt", "Status", "Nachricht", "Zeit"].map((cell) => (
                  <th key={cell} style={thStyle}>
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((lead) => (
                <tr key={lead.id}>
                  <td style={tdStyle}>
                    <strong>{lead.name}</strong>
                  </td>
                  <td style={tdStyle}>{lead.siteName || lead.siteId}</td>
                  <td style={tdStyle}>
                    <div>{lead.email}</div>
                    {lead.phone && <div style={{ color: "#6b7280" }}>{lead.phone}</div>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "grid", gap: 8 }}>
                      <LeadStatusBadge status={lead.status} />
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        style={{ padding: 8, borderRadius: 8, border: "1px solid #d1d5db" }}
                      >
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="qualified">qualified</option>
                        <option value="lost">lost</option>
                      </select>
                    </div>
                  </td>
                  <td style={tdStyle}>{lead.message || "-"}</td>
                  <td style={tdStyle}>{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
