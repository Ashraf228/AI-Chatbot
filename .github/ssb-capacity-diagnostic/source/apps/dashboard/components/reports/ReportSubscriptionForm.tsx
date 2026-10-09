"use client";

import { useEffect, useState } from "react";
import { ReportTriggerButton } from "./ReportTriggerButton";
import { Button } from "../shared/Button";
import { EmptyState } from "../shared/EmptyState";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { Select } from "../shared/Select";

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
    <div className="dashboard-grid">
      {siteId && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Report-Empfänger</h2>
          <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr 180px 160px", gap: 12 }}>
            <Input
              placeholder="report@kunde.de"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
            />
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </Select>
            <Button onClick={createSubscription} disabled={saving}>
              {saving ? "Speichert..." : "Hinzufügen"}
            </Button>
          </div>
          {error && <ErrorState message={error} />}
        </div>
      )}

      <div className="dashboard-card">
        <div className="dashboard-inline" style={{ justifyContent: "space-between", marginBottom: 16 }}>
          <h2 className="dashboard-card-title" style={{ marginBottom: 0 }}>Subscriptions</h2>
          <ReportTriggerButton siteId={siteId} />
        </div>
        {items.length === 0 ? (
          <EmptyState title="Keine Report-Subscriptions vorhanden." />
        ) : (
          <div className="dashboard-stack dashboard-stack--sm">
            {items.map((item) => (
              <div
                key={item.id}
                className="dashboard-card"
                style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 100px", gap: 12, alignItems: "center", padding: 14 }}
              >
                <div>
                  <strong>{item.recipientEmail}</strong>
                  {!siteId && <div className="dashboard-copy" style={{ marginTop: 4 }}>Site: {item.siteId}</div>}
                </div>
                <div>{item.frequency}</div>
                <Button variant="secondary" onClick={() => toggleSubscription(item)}>
                  {item.isEnabled ? "Aktiv" : "Pausiert"}
                </Button>
                <Button variant="danger" onClick={() => removeSubscription(item.id)}>
                  Entfernen
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
