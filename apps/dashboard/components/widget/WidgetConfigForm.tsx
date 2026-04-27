"use client";

import { useEffect, useState } from "react";
import { ConsentSettings } from "./ConsentSettings";
import { LeadFlowSettings } from "./LeadFlowSettings";
import { SuggestedQuestionsEditor } from "./SuggestedQuestionsEditor";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";

type WidgetConfigFormProps = {
  siteId: string;
};

const DEFAULT_CONVERSATION_FLOW = {
  questions: {
    opening: "Geht es bei dir eher um Support, Prozesse, Marketing oder etwas anderes?",
    industry: "Für welches Unternehmen oder welche Branche ist das gedacht?",
    urgency: "Wie dringend oder wie groß ist das Thema aktuell bei euch?",
  },
  instructions: {
    clarify:
      "Wenn der Einstieg allgemein ist, stelle genau eine Qualifizierungsfrage und gehe noch nicht direkt auf Termin.",
    qualifiedMissingIndustry:
      "Wenn der Bedarf klar ist, aber die Branche fehlt, gib kurz eine Einordnung und frage gezielt nach der Branche.",
    qualifiedMissingUrgency:
      "Wenn der Bedarf klar ist, aber die Dringlichkeit fehlt, gib kurz eine Einordnung und frage gezielt nach Dringlichkeit oder Umfang.",
    qualifiedReady:
      "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite direkt in Richtung Kontakt oder Termin.",
    contactReady:
      "Wenn der Nutzer Kontakt möchte oder zustimmt, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
  },
  triggers: {
    contactIntent: ["kontakt", "anfrage", "angebot", "termin", "rueckruf"],
    qualifiedNeed: ["support", "kundenservice", "marketing", "prozesse", "automatisierung"],
    industry: ["unternehmen", "firma", "agentur", "shop", "kanzlei", "praxis"],
    urgency: ["sofort", "dringend", "zeitnah", "schnell"],
  },
};

function formatConversationFlow(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    return JSON.stringify(DEFAULT_CONVERSATION_FLOW, null, 2);
  }

  return JSON.stringify(value, null, 2);
}

export function WidgetConfigForm({ siteId }: WidgetConfigFormProps) {
  const [form, setForm] = useState({
    siteKey: "",
    domain: "",
    widgetBundleUrl: "",
    systemPrompt: "",
    isActive: true,
    consentRequired: true,
    leadCaptureEnabled: true,
    leadNotificationEmail: "",
    allowedDomains: "",
    suggestedQuestionsByPath: "{\n  \"/\": [\"Was kostet der Service?\"]\n}",
    conversationFlow: JSON.stringify(DEFAULT_CONVERSATION_FLOW, null, 2),
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
        systemPrompt: data.systemPrompt || "",
        isActive: data.isActive ?? true,
        consentRequired: data.consentRequired ?? true,
        leadCaptureEnabled: data.leadCaptureEnabled ?? true,
        leadNotificationEmail: data.leadNotificationEmail || "",
        allowedDomains: (data.allowedDomains || []).join(", "),
        suggestedQuestionsByPath: JSON.stringify(data.suggestedQuestionsByPath || {}, null, 2),
        conversationFlow: formatConversationFlow(data.conversationFlow),
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
    let conversationFlow: Record<string, unknown>;
    try {
      suggestedQuestionsByPath = JSON.parse(form.suggestedQuestionsByPath || "{}");
    } catch {
      setError("Suggested Questions muessen gueltiges JSON sein.");
      setSaving(false);
      return;
    }

    try {
      conversationFlow = JSON.parse(form.conversationFlow || "{}");
    } catch {
      setError("Conversation Flow muss gueltiges JSON sein.");
      setSaving(false);
      return;
    }

    const payload = {
      siteKey: form.siteKey,
      domain: form.domain,
      widgetBundleUrl: form.widgetBundleUrl,
      systemPrompt: form.systemPrompt.trim() || undefined,
      isActive: form.isActive,
      consentRequired: form.consentRequired,
      leadCaptureEnabled: form.leadCaptureEnabled,
      leadNotificationEmail: form.leadNotificationEmail.trim() || undefined,
      allowedDomains: form.allowedDomains
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      suggestedQuestionsByPath,
      conversationFlow,
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
    return <LoadingState />;
  }

  return (
    <div className="dashboard-card">
      <h2 className="dashboard-card-title">Widget Setup</h2>
      <div className="dashboard-stack">
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
        <label className="dashboard-field">
          <span className="dashboard-field-label">System Prompt</span>
          <textarea
            className="dashboard-textarea"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            placeholder="Optionaler kundenspezifischer Systemprompt. Leer lassen = globaler Standard."
            style={{ minHeight: 200 }}
          />
        </label>

        <label className="dashboard-checkbox">
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
        <Field
          label="Lead-Benachrichtigung E-Mail"
          value={form.leadNotificationEmail}
          onChange={(value) => setForm({ ...form, leadNotificationEmail: value })}
        />
        <SuggestedQuestionsEditor
          value={form.suggestedQuestionsByPath}
          onChange={(value) => setForm({ ...form, suggestedQuestionsByPath: value })}
        />
        <label className="dashboard-field">
          <span className="dashboard-field-label">Conversation Flow (JSON)</span>
          <textarea
            className="dashboard-textarea dashboard-mono"
            value={form.conversationFlow}
            onChange={(e) => setForm({ ...form, conversationFlow: e.target.value })}
            placeholder="Optionaler Conversation Flow als JSON"
            style={{ minHeight: 320 }}
          />
        </label>

        <Button onClick={save} disabled={saving}>
          {saving ? "Speichert..." : "Widget-Konfiguration speichern"}
        </Button>
        {message && <p className="dashboard-status dashboard-status--success">{message}</p>}
        {error && <ErrorState message={error} />}
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
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
