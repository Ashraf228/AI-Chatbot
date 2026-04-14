"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ConsentSettings } from "./ConsentSettings";
import { LeadFlowSettings } from "./LeadFlowSettings";
import { SuggestedQuestionsEditor } from "./SuggestedQuestionsEditor";

type WidgetConfigFormProps = {
  siteId: string;
};

export function WidgetConfigForm({ siteId }: WidgetConfigFormProps) {
  const [form, setForm] = useState({
    siteKey: "",
    domain: "",
    widgetBundleUrl: "",
    isActive: true,
    consentRequired: true,
    leadCaptureEnabled: true,
    allowedDomains: "",
    suggestedQuestionsByPath: "{\n  \"/\": [\"Was kostet der Service?\"]\n}",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Widget-Konfiguration konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      setForm({
        siteKey: data.siteKey || siteId,
        domain: data.domain || "",
        widgetBundleUrl: data.widgetBundleUrl || "",
        isActive: data.isActive ?? true,
        consentRequired: data.consentRequired ?? true,
        leadCaptureEnabled: data.leadCaptureEnabled ?? true,
        allowedDomains: (data.allowedDomains || []).join(", "),
        suggestedQuestionsByPath: JSON.stringify(data.suggestedQuestionsByPath || {}, null, 2),
      });
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    let suggestedQuestionsByPath: Record<string, string[]>;
    try {
      suggestedQuestionsByPath = JSON.parse(form.suggestedQuestionsByPath || "{}");
    } catch {
      setError("Suggested Questions muessen gueltiges JSON sein.");
      setSaving(false);
      return;
    }

    const payload = {
      siteKey: form.siteKey,
      domain: form.domain,
      widgetBundleUrl: form.widgetBundleUrl,
      isActive: form.isActive,
      consentRequired: form.consentRequired,
      leadCaptureEnabled: form.leadCaptureEnabled,
      allowedDomains: form.allowedDomains
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      suggestedQuestionsByPath,
    };

    const res = await fetch(`/api/widget/config/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "Widget-Konfiguration konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setMessage("Widget-Konfiguration gespeichert.");
    setSaving(false);
  }

  if (loading) {
    return <div style={panelStyle}>Widget-Konfiguration wird geladen...</div>;
  }

  return (
    <div style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>Widget Setup</h2>
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="Site Key" value={form.siteKey} onChange={(value) => setForm({ ...form, siteKey: value })} />
        <Field label="Primäre Domain" value={form.domain} onChange={(value) => setForm({ ...form, domain: value })} />
        <Field
          label="Erlaubte Domains (kommagetrennt)"
          value={form.allowedDomains}
          onChange={(value) => setForm({ ...form, allowedDomains: value })}
        />
        <Field
          label="Widget Bundle URL"
          value={form.widgetBundleUrl}
          onChange={(value) => setForm({ ...form, widgetBundleUrl: value })}
        />

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span>Widget aktiv</span>
        </label>

        <ConsentSettings
          checked={form.consentRequired}
          onChange={(value) => setForm({ ...form, consentRequired: value })}
        />
        <LeadFlowSettings
          checked={form.leadCaptureEnabled}
          onChange={(value) => setForm({ ...form, leadCaptureEnabled: value })}
        />
        <SuggestedQuestionsEditor
          value={form.suggestedQuestionsByPath}
          onChange={(value) => setForm({ ...form, suggestedQuestionsByPath: value })}
        />

        <button onClick={save} disabled={saving} style={buttonStyle}>
          {saving ? "Speichert..." : "Widget-Konfiguration speichern"}
        </button>
        {message && <div style={{ color: "#047857" }}>{message}</div>}
        {error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: 10, border: "1px solid #d1d5db", borderRadius: 10 }}
      />
    </label>
  );
}

const panelStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const buttonStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};
