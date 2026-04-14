"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ReportTriggerButton } from "./ReportTriggerButton";

type ReportSubscriptionFormProps = {
  siteId?: string;
};

type Subscription = {
  id: string;
  siteId: string;
  recipientEmail: string;
  frequency: string;
  isEnabled: boolean;
};

export function ReportSubscriptionForm({ siteId }: ReportSubscriptionFormProps) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (siteId) params.set("siteId", siteId);
    const res = await fetch(`/api/widget/report-subscriptions?${params.toString()}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      setError(data?.message || "Subscriptions konnten nicht geladen werden.");
      return;
    }
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, [siteId]);

  async function createSubscription() {
    if (!siteId) {
      setError("Fuer eine neue Subscription wird eine Site benoetigt.");
      return;
    }

    setSaving(true);
    setError(null);
    const res = await fetch("/api/widget/report-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, recipientEmail, frequency, isEnabled: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "Subscription konnte nicht erstellt werden.");
      setSaving(false);
      return;
    }
    setRecipientEmail("");
    setSaving(false);
    load();
  }

  async function toggleSubscription(item: Subscription) {
    await fetch(`/api/widget/report-subscriptions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !item.isEnabled }),
    });
    load();
  }

  async function removeSubscription(id: string) {
    await fetch(`/api/widget/report-subscriptions/${id}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {siteId && (
        <div style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>Report-Empfänger</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 160px", gap: 12 }}>
            <input
              placeholder="report@kunde.de"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
            <button onClick={createSubscription} disabled={saving} style={buttonStyle}>
              {saving ? "Speichert..." : "Hinzufügen"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: "#b91c1c" }}>{error}</div>}
        </div>
      )}

      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Subscriptions</h2>
          <ReportTriggerButton siteId={siteId} />
        </div>
        {items.length === 0 ? (
          <div style={{ marginTop: 14 }}>Keine Report-Subscriptions vorhanden.</div>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 120px 100px",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div>
                  <strong>{item.recipientEmail}</strong>
                  {!siteId && <div style={{ color: "#6b7280", marginTop: 4 }}>Site: {item.siteId}</div>}
                </div>
                <div>{item.frequency}</div>
                <button onClick={() => toggleSubscription(item)} style={secondaryButtonStyle}>
                  {item.isEnabled ? "Aktiv" : "Pausiert"}
                </button>
                <button onClick={() => removeSubscription(item.id)} style={dangerButtonStyle}>
                  Entfernen
                </button>
              </div>
            ))}
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

const buttonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  color: "#991b1b",
};
