"use client";

import { useEffect, useState } from "react";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";

type RetentionForm = {
  chatRetentionDays: number;
  leadRetentionDays: number;
  reportRetentionDays: number;
};

export function CustomerRetentionSettings({ siteId }: { siteId: string }) {
  const [form, setForm] = useState<RetentionForm>({
    chatRetentionDays: 90,
    leadRetentionDays: 365,
    reportRetentionDays: 365,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Aufbewahrung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setForm({
        chatRetentionDays: Number(data.chatRetentionDays || 90),
        leadRetentionDays: Number(data.leadRetentionDays || 365),
        reportRetentionDays: Number(data.reportRetentionDays || 365),
      });
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/widget/config/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data?.message || "Aufbewahrung konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setForm({
      chatRetentionDays: Number(data.chatRetentionDays || form.chatRetentionDays),
      leadRetentionDays: Number(data.leadRetentionDays || form.leadRetentionDays),
      reportRetentionDays: Number(data.reportRetentionDays || form.reportRetentionDays),
    });
    setMessage("Aufbewahrung gespeichert.");
    setSaving(false);
  }

  function updateField(key: keyof RetentionForm, value: string) {
    setForm((current) => ({
      ...current,
      [key]: Math.max(1, Number(value || 1)),
    }));
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <section className="dashboard-card dashboard-stack">
      <div>
        <h2 className="dashboard-card-title">Datenschutz & Aufbewahrung</h2>
        <p className="dashboard-copy">
          Lege fest, wie lange personenbezogene Kundendaten automatisch aufbewahrt werden.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Chats aufbewahren</span>
          <Input
            type="number"
            min={1}
            max={3650}
            value={form.chatRetentionDays}
            onChange={(event) => updateField("chatRetentionDays", event.target.value)}
          />
          <span className="dashboard-copy dashboard-copy--muted">Tage, Standard: 90</span>
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Anfragen aufbewahren</span>
          <Input
            type="number"
            min={1}
            max={3650}
            value={form.leadRetentionDays}
            onChange={(event) => updateField("leadRetentionDays", event.target.value)}
          />
          <span className="dashboard-copy dashboard-copy--muted">Tage, Standard: 365</span>
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Berichte aufbewahren</span>
          <Input
            type="number"
            min={1}
            max={3650}
            value={form.reportRetentionDays}
            onChange={(event) => updateField("reportRetentionDays", event.target.value)}
          />
          <span className="dashboard-copy dashboard-copy--muted">Tage, Standard: 365</span>
        </label>
      </div>

      <Button type="button" onClick={save} disabled={saving}>
        {saving ? "Speichert..." : "Aufbewahrung speichern"}
      </Button>
      {message ? <p className="dashboard-status dashboard-status--success">{message}</p> : null}
      {error ? <ErrorState message={error} /> : null}
    </section>
  );
}
