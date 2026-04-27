"use client";

import { useEffect, useState } from "react";
import { ConsentSettings } from "./ConsentSettings";
import { LeadFlowSettings } from "./LeadFlowSettings";
import { SuggestedQuestionsEditor } from "./SuggestedQuestionsEditor";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

type WidgetConfigFormProps = {
  siteId: string;
};

type ConversationFlowForm = {
  questions: {
    opening: string;
    industry: string;
    urgency: string;
  };
  instructions: {
    clarify: string;
    qualifiedMissingIndustry: string;
    qualifiedMissingUrgency: string;
    qualifiedReady: string;
    contactReady: string;
  };
  triggers: {
    contactIntent: string[];
    qualifiedNeed: string[];
    industry: string[];
    urgency: string[];
  };
};

const DEFAULT_CONVERSATION_FLOW: ConversationFlowForm = {
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

const FLOW_PRESETS: Record<string, { label: string; description: string; flow: ConversationFlowForm }> = {
  leadQualification: {
    label: "Lead-Qualifizierung",
    description: "Für Erstgespräche, Bedarf verstehen und zügig Richtung Kontakt leiten.",
    flow: DEFAULT_CONVERSATION_FLOW,
  },
  support: {
    label: "Support",
    description: "Für Support-Anliegen mit Fokus auf Problem, Kontext und anschließende Weiterleitung.",
    flow: {
      questions: {
        opening: "Geht es bei dir eher um ein akutes Problem, eine Rückfrage zu einem Vorgang oder allgemeine Hilfe?",
        industry: "Geht es um einen bestimmten Kundenfall, ein Produkt oder einen internen Ablauf?",
        urgency: "Wie dringend ist das Thema gerade für dich?",
      },
      instructions: {
        clarify:
          "Wenn das Anliegen noch unklar ist, frage gezielt nach dem konkreten Supportfall und halte die Antwort ruhig und lösungsorientiert.",
        qualifiedMissingIndustry:
          "Wenn das Problem klar ist, aber der genaue Kontext fehlt, frage nach Produkt, Vorgang oder betroffenem Bereich.",
        qualifiedMissingUrgency:
          "Wenn das Problem klar ist, aber die Auswirkung fehlt, frage nach Dringlichkeit oder konkreter Einschränkung.",
        qualifiedReady:
          "Wenn das Support-Anliegen klar ist, gib eine kurze Einordnung und leite in Richtung Kontakt oder Übergabe an das Team.",
        contactReady:
          "Wenn der Nutzer Hilfe von einem Menschen möchte, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anruf", "rueckruf", "hilfe vom team", "weiterleiten", "termin"],
        qualifiedNeed: ["support", "hilfe", "problem", "fehler", "funktioniert nicht", "störung", "frage"],
        industry: ["kunde", "produkt", "bestellung", "auftrag", "rechnung", "konto", "vorgang"],
        urgency: ["sofort", "dringend", "schnell", "akut", "heute", "jetzt"],
      },
    },
  },
  appointment: {
    label: "Terminbuchung",
    description: "Für Nutzer, die relativ früh einen Termin oder Rückruf wollen.",
    flow: {
      questions: {
        opening: "Möchtest du eher einen kurzen Termin, einen Rückruf oder erst eine kurze Einschätzung?",
        industry: "Worum geht es grob, damit wir den richtigen Ansprechpartner einplanen können?",
        urgency: "Wann wäre es für dich am besten oder wie zeitnah soll sich jemand melden?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg noch offen ist, kläre schnell die gewünschte Kontaktart und halte das Gespräch kurz.",
        qualifiedMissingIndustry:
          "Wenn der Terminwunsch klar ist, aber das Thema fehlt, frage kurz nach dem Anlass des Gesprächs.",
        qualifiedMissingUrgency:
          "Wenn der Terminwunsch klar ist, aber der Zeithorizont fehlt, frage kurz nach der gewünschten Geschwindigkeit.",
        qualifiedReady:
          "Wenn Kontaktart und Anlass klar sind, leite direkt in die Termin- oder Kontaktaufnahme weiter.",
        contactReady:
          "Wenn der Nutzer bereits zustimmt, bestätige kurz und leite sofort zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["termin", "rueckruf", "rückruf", "anrufen", "telefonat", "gespraech", "gespräch"],
        qualifiedNeed: ["termin", "beratung", "rueckruf", "rückruf", "angebot", "kontakt"],
        industry: ["projekt", "website", "support", "marketing", "ki", "automatisierung", "prozess"],
        urgency: ["morgen", "heute", "diese woche", "zeitnah", "schnell", "sofort"],
      },
    },
  },
  sales: {
    label: "Verkaufsgespräch",
    description: "Für stärker vertriebsorientierte Einstiege mit Fokus auf Potenzial und Abschluss.",
    flow: {
      questions: {
        opening: "Geht es bei dir eher um mehr Anfragen, effizientere Prozesse oder bessere Unterstützung im Tagesgeschäft?",
        industry: "In welcher Branche oder in welchem Geschäftsmodell seid ihr unterwegs?",
        urgency: "Wie stark drückt das Thema gerade oder wie schnell wollt ihr etwas verändern?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, ordne das Potenzial kurz ein und stelle eine konkrete Bedarfsfrage.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Unternehmenskontext fehlt, frage gezielt nach Branche, Zielgruppe oder Geschäftsmodell.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber Priorität oder Druck fehlen, frage gezielt nach Tempo, Aufwand oder aktuellem Schmerz.",
        qualifiedReady:
          "Wenn Potenzial und Kontext klar sind, gib eine kurze Einschätzung und führe selbstbewusst Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer offen für den nächsten Schritt ist, bestätige kurz und leite ohne Umweg zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anfrage", "angebot", "termin", "rueckruf", "rückruf", "sprechen"],
        qualifiedNeed: ["leads", "kunden", "marketing", "vertrieb", "support", "prozesse", "automatisierung", "ki"],
        industry: ["unternehmen", "agentur", "shop", "dienstleistung", "e-commerce", "praxis", "kanzlei"],
        urgency: ["dringend", "zeitnah", "schnell", "dieses quartal", "sofort", "heute"],
      },
    },
  },
};

function normalizeTriggerList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatTriggerList(values: string[]) {
  return values.join(", ");
}

function mergeConversationFlow(value: unknown): ConversationFlowForm {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CONVERSATION_FLOW;
  }

  const raw = value as Record<string, unknown>;
  const questions =
    raw.questions && typeof raw.questions === "object" && !Array.isArray(raw.questions)
      ? (raw.questions as Record<string, unknown>)
      : {};
  const instructions =
    raw.instructions && typeof raw.instructions === "object" && !Array.isArray(raw.instructions)
      ? (raw.instructions as Record<string, unknown>)
      : {};
  const triggers =
    raw.triggers && typeof raw.triggers === "object" && !Array.isArray(raw.triggers)
      ? (raw.triggers as Record<string, unknown>)
      : {};

  return {
    questions: {
      opening:
        typeof questions.opening === "string" && questions.opening.trim().length > 0
          ? questions.opening
          : DEFAULT_CONVERSATION_FLOW.questions.opening,
      industry:
        typeof questions.industry === "string" && questions.industry.trim().length > 0
          ? questions.industry
          : DEFAULT_CONVERSATION_FLOW.questions.industry,
      urgency:
        typeof questions.urgency === "string" && questions.urgency.trim().length > 0
          ? questions.urgency
          : DEFAULT_CONVERSATION_FLOW.questions.urgency,
    },
    instructions: {
      clarify:
        typeof instructions.clarify === "string" && instructions.clarify.trim().length > 0
          ? instructions.clarify
          : DEFAULT_CONVERSATION_FLOW.instructions.clarify,
      qualifiedMissingIndustry:
        typeof instructions.qualifiedMissingIndustry === "string" &&
        instructions.qualifiedMissingIndustry.trim().length > 0
          ? instructions.qualifiedMissingIndustry
          : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedMissingIndustry,
      qualifiedMissingUrgency:
        typeof instructions.qualifiedMissingUrgency === "string" &&
        instructions.qualifiedMissingUrgency.trim().length > 0
          ? instructions.qualifiedMissingUrgency
          : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedMissingUrgency,
      qualifiedReady:
        typeof instructions.qualifiedReady === "string" && instructions.qualifiedReady.trim().length > 0
          ? instructions.qualifiedReady
          : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedReady,
      contactReady:
        typeof instructions.contactReady === "string" && instructions.contactReady.trim().length > 0
          ? instructions.contactReady
          : DEFAULT_CONVERSATION_FLOW.instructions.contactReady,
    },
    triggers: {
      contactIntent: Array.isArray(triggers.contactIntent)
        ? triggers.contactIntent.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.contactIntent,
      qualifiedNeed: Array.isArray(triggers.qualifiedNeed)
        ? triggers.qualifiedNeed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.qualifiedNeed,
      industry: Array.isArray(triggers.industry)
        ? triggers.industry.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.industry,
      urgency: Array.isArray(triggers.urgency)
        ? triggers.urgency.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.urgency,
    },
  };
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
    conversationFlow: DEFAULT_CONVERSATION_FLOW,
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
        conversationFlow: mergeConversationFlow(data.conversationFlow),
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
      conversationFlow: form.conversationFlow,
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

        <ConversationFlowEditor
          value={form.conversationFlow}
          onChange={(conversationFlow) => setForm({ ...form, conversationFlow })}
        />

        <Button onClick={save} disabled={saving}>
          {saving ? "Speichert..." : "Widget-Konfiguration speichern"}
        </Button>
        {message && <p className="dashboard-status dashboard-status--success">{message}</p>}
        {error && <ErrorState message={error} />}
      </div>
    </div>
  );
}

function ConversationFlowEditor({
  value,
  onChange,
}: {
  value: ConversationFlowForm;
  onChange: (value: ConversationFlowForm) => void;
}) {
  const [presetKey, setPresetKey] = useState<keyof typeof FLOW_PRESETS>("leadQualification");
  const selectedPreset = FLOW_PRESETS[presetKey];

  return (
    <div className="dashboard-card" style={{ padding: 20, background: "rgba(255,255,255,0.7)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h3 className="dashboard-card-title" style={{ marginBottom: 6 }}>
            Conversation Flow
          </h3>
          <p className="dashboard-copy" style={{ marginTop: 0 }}>
            Steuere hier, welche Frage der Bot zuerst stellt, wann er nachhakt und ab wann er Richtung Kontakt geht.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onChange(DEFAULT_CONVERSATION_FLOW)}
          style={{ width: "auto", minWidth: 180 }}
        >
          Standard wiederherstellen
        </Button>
      </div>

      <div className="dashboard-stack" style={{ marginTop: 20 }}>
        <div className="dashboard-card dashboard-card--soft">
          <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Vorlage</span>
              <Select value={presetKey} onChange={(e) => setPresetKey(e.target.value as keyof typeof FLOW_PRESETS)}>
                {Object.entries(FLOW_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="dashboard-field">
              <span className="dashboard-field-label">Beschreibung</span>
              <p className="dashboard-copy" style={{ margin: 0 }}>
                {selectedPreset.description}
              </p>
            </div>
          </div>
          <div className="dashboard-inline" style={{ marginTop: 14 }}>
            <Button type="button" onClick={() => onChange(selectedPreset.flow)} style={{ width: "auto", minWidth: 180 }}>
              Vorlage anwenden
            </Button>
            <p className="dashboard-copy" style={{ margin: 0 }}>
              Ueberschreibt die Felder unten mit der gewählten Vorlage.
            </p>
          </div>
        </div>

        <SectionTitle title="Fragen" text="Diese Fragen nutzt der Bot bevorzugt in den jeweiligen Phasen." />
        <TextareaField
          label="Einstiegsfrage"
          value={value.questions.opening}
          onChange={(next) =>
            onChange({
              ...value,
              questions: { ...value.questions, opening: next },
            })
          }
        />
        <TextareaField
          label="Branchenfrage"
          value={value.questions.industry}
          onChange={(next) =>
            onChange({
              ...value,
              questions: { ...value.questions, industry: next },
            })
          }
        />
        <TextareaField
          label="Dringlichkeitsfrage"
          value={value.questions.urgency}
          onChange={(next) =>
            onChange({
              ...value,
              questions: { ...value.questions, urgency: next },
            })
          }
        />

        <SectionTitle
          title="Gesprächsregeln"
          text="Hier legst du fest, wie der Bot in jeder Phase kurz geführt werden soll."
        />
        <TextareaField
          label="Wenn der Einstieg noch allgemein ist"
          value={value.instructions.clarify}
          onChange={(next) =>
            onChange({
              ...value,
              instructions: { ...value.instructions, clarify: next },
            })
          }
        />
        <TextareaField
          label="Wenn die Branche noch fehlt"
          value={value.instructions.qualifiedMissingIndustry}
          onChange={(next) =>
            onChange({
              ...value,
              instructions: { ...value.instructions, qualifiedMissingIndustry: next },
            })
          }
        />
        <TextareaField
          label="Wenn Dringlichkeit oder Umfang noch fehlt"
          value={value.instructions.qualifiedMissingUrgency}
          onChange={(next) =>
            onChange({
              ...value,
              instructions: { ...value.instructions, qualifiedMissingUrgency: next },
            })
          }
        />
        <TextareaField
          label="Wenn genug Infos da sind"
          value={value.instructions.qualifiedReady}
          onChange={(next) =>
            onChange({
              ...value,
              instructions: { ...value.instructions, qualifiedReady: next },
            })
          }
        />
        <TextareaField
          label="Wenn der Nutzer kontaktbereit ist"
          value={value.instructions.contactReady}
          onChange={(next) =>
            onChange({
              ...value,
              instructions: { ...value.instructions, contactReady: next },
            })
          }
        />

        <SectionTitle
          title="Triggerwörter"
          text="Kommagetrennte Wörter oder Phrasen, an denen der Bot bestimmte Phasen erkennt."
        />
        <TriggerField
          label="Kontaktwunsch"
          value={value.triggers.contactIntent}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, contactIntent: next },
            })
          }
        />
        <TriggerField
          label="Klarer Bedarf"
          value={value.triggers.qualifiedNeed}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, qualifiedNeed: next },
            })
          }
        />
        <TriggerField
          label="Branchenkontext"
          value={value.triggers.industry}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, industry: next },
            })
          }
        />
        <TriggerField
          label="Dringlichkeit"
          value={value.triggers.urgency}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, urgency: next },
            })
          }
        />
      </div>
    </div>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="dashboard-card-title" style={{ marginBottom: 6 }}>
        {title}
      </h3>
      <p className="dashboard-copy" style={{ marginTop: 0 }}>
        {text}
      </p>
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

function TextareaField({
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
      <textarea
        className="dashboard-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 110 }}
      />
    </label>
  );
}

function TriggerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <Input value={formatTriggerList(value)} onChange={(e) => onChange(normalizeTriggerList(e.target.value))} />
    </label>
  );
}
