"use client";

import { useState } from "react";
import { Button } from "../../shared/Button";

type ConversationDecision = {
  intent: string;
  goal: string;
  stage: string;
  confidence: number;
  selectedAgentKey: string | null;
  requiredFields: string[];
  missingFields: string[];
  knownFields: string[];
  nextAction: string;
  shouldUseKnowledge: boolean;
  shouldHandoff: boolean;
  shouldAskQuestion: boolean;
  shouldSummarize: boolean;
  warnings: string[];
  reasons: string[];
};

type PreviewResponse = {
  conversationEnginePreview: ConversationDecision | null;
  previewEnabled?: boolean;
};

type ConversationEnginePreviewCardProps = {
  siteId: string;
};

const INTENT_LABELS: Record<string, string> = {
  question: "Frage",
  support: "Support",
  sales: "Vertrieb / Anfrage",
  appointment: "Termin",
  ticket: "Ticket",
  product_advice: "Produktberatung",
  complaint: "Beschwerde",
  handoff: "Übergabe",
  unknown: "Unklar",
};

const GOAL_LABELS: Record<string, string> = {
  answer_from_knowledge: "Aus Wissensbasis beantworten",
  solve_problem: "Problem lösen",
  collect_request: "Anfrage erfassen",
  create_ticket: "Ticket vorbereiten",
  recommend_product: "Produkt empfehlen",
  prepare_contact: "Kontakt vorbereiten",
  trigger_integration: "Integration auslösen",
  escalate_human: "An Menschen übergeben",
  clarify_intent: "Absicht klären",
};

function label(value: string, labels: Record<string, string>) {
  return labels[value] || value;
}

function compactPreviewJson(decision: ConversationDecision) {
  return JSON.stringify(decision, null, 2);
}

export function ConversationEnginePreviewCard({ siteId }: ConversationEnginePreviewCardProps) {
  const [message, setMessage] = useState("");
  const [decision, setDecision] = useState<ConversationDecision | null>(null);
  const [previewEnabled, setPreviewEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setDecision(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json().catch(() => ({}))) as PreviewResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Gesprächslogik-Vorschau konnte nicht geladen werden.");
      }
      setPreviewEnabled(data.previewEnabled === true);
      setDecision(data.conversationEnginePreview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gesprächslogik-Vorschau konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Gesprächslogik Vorschau</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Nur Vorschau – beeinflusst das Live-Widget nicht und löst keine Leads, Tickets, E-Mails oder Webhooks aus.
        </p>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Testnachricht für die neue Conversation Engine</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Beispiel: Ich brauche Hilfe mit meinem VPN"
        />
      </label>

      <Button type="button" variant="secondary" onClick={runPreview} disabled={loading || !message.trim()}>
        {loading ? "Vorschau läuft..." : "Gesprächslogik prüfen"}
      </Button>

      {previewEnabled === false ? (
        <div className="dashboard-status dashboard-status--pending">
          Conversation-Engine-Vorschau ist deaktiviert. Setzen Sie zuerst conversationEngine.previewEnabled.
        </div>
      ) : null}

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      {decision ? (
        <div className="dashboard-stack dashboard-stack--sm">
          <div className="dashboard-grid dashboard-grid--metrics-3">
            <div className="dashboard-card dashboard-card--compact">
              <strong>Absicht</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">{label(decision.intent, INTENT_LABELS)}</p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Ziel</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">{label(decision.goal, GOAL_LABELS)}</p>
            </div>
            <div className="dashboard-card dashboard-card--compact">
              <strong>Agent</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">{decision.selectedAgentKey || "kein Agent"}</p>
            </div>
          </div>

          <p className="dashboard-copy dashboard-no-margin-bottom">
            <strong>Nächste Aktion:</strong> {decision.nextAction}
          </p>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Fehlende Informationen: {decision.missingFields.length > 0 ? decision.missingFields.join(", ") : "keine"}
          </p>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Übergabe bereit: {decision.shouldHandoff ? "ja" : "nein"}
          </p>

          {decision.warnings.length > 0 ? (
            <div className="dashboard-status dashboard-status--warning">
              Hinweise: {decision.warnings.join(" · ")}
            </div>
          ) : null}

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-accordion__summary">Erweitert: technische ConversationDecision</summary>
            <pre className="dashboard-code-block dashboard-mt-14">{compactPreviewJson(decision)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
