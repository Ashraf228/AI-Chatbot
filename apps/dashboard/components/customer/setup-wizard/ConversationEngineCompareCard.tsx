"use client";

import { useState } from "react";
import { Button } from "../../shared/Button";

type CompareResponse = {
  compareEnabled?: boolean;
  legacy: null | {
    replyPreview: string;
    route: string;
    usedKnowledge: boolean;
    wouldCreateLead: boolean;
    wouldCreateTicket: boolean;
    wouldTriggerIntegration: boolean;
    warnings: string[];
  };
  engine: null | {
    conversationDecision: {
      intent: string;
      goal: string;
      selectedAgentKey: string | null;
      nextAction: string;
      missingFields: string[];
      shouldHandoff: boolean;
      confidence: number;
    };
  };
  comparison: {
    status: "aligned" | "partial" | "conflict" | "unknown";
    findings: string[];
    risks: string[];
    recommendations: string[];
  };
};

type ConversationEngineCompareCardProps = {
  siteId: string;
};

const STATUS_LABELS: Record<string, string> = {
  aligned: "passt",
  partial: "teilweise passend",
  conflict: "Konflikt",
  unknown: "unklar",
};

const STATUS_TONE: Record<string, string> = {
  aligned: "success",
  partial: "warning",
  conflict: "error",
  unknown: "pending",
};

function compactJson(value: CompareResponse) {
  return JSON.stringify(value, null, 2);
}

export function ConversationEngineCompareCard({ siteId }: ConversationEngineCompareCardProps) {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCompare() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json().catch(() => ({}))) as CompareResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Gesprächslogik-Vergleich konnte nicht geladen werden.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gesprächslogik-Vergleich konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  const status = result?.comparison.status || "unknown";
  const tone = STATUS_TONE[status] || "pending";

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Gesprächslogik Vergleich</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Nur Test – Live-Widget bleibt unverändert. Es werden keine Leads, Tickets, E-Mails oder Webhooks ausgelöst.
        </p>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Testnachricht für Legacy-vs-Engine Vergleich</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Beispiel: Ich möchte zurückgerufen werden"
        />
      </label>

      <Button type="button" variant="secondary" onClick={runCompare} disabled={loading || !message.trim()}>
        {loading ? "Vergleich läuft..." : "Legacy und neue Logik vergleichen"}
      </Button>

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      {result?.compareEnabled === false ? (
        <div className="dashboard-status dashboard-status--pending">
          Vergleichsmodus ist deaktiviert. Aktivieren Sie conversationEngine.previewEnabled und conversationEngine.compareEnabled.
        </div>
      ) : null}

      {result?.legacy && result.engine ? (
        <div className="dashboard-stack dashboard-stack--sm">
          <div className={`dashboard-status dashboard-status--${tone}`}>
            Vergleichsstatus: {STATUS_LABELS[status] || status}
          </div>

          <div className="dashboard-grid dashboard-grid--split">
            <div className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
              <strong>Legacy-Antwort</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">{result.legacy.replyPreview}</p>
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                Route: {result.legacy.route}, Wissen: {result.legacy.usedKnowledge ? "ja" : "nein"}
              </p>
            </div>
            <div className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
              <strong>Neue Engine</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                Absicht: {result.engine.conversationDecision.intent}
              </p>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                Ziel: {result.engine.conversationDecision.goal}
              </p>
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                Agent: {result.engine.conversationDecision.selectedAgentKey || "kein Agent"}
              </p>
            </div>
          </div>

          <p className="dashboard-copy dashboard-no-margin-bottom">
            <strong>Nächste Aktion:</strong> {result.engine.conversationDecision.nextAction}
          </p>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Fehlende Informationen:{" "}
            {result.engine.conversationDecision.missingFields.length > 0
              ? result.engine.conversationDecision.missingFields.join(", ")
              : "keine"}
          </p>

          {result.comparison.findings.length > 0 ? (
            <InfoList title="Befunde" items={result.comparison.findings} />
          ) : null}
          {result.comparison.risks.length > 0 ? (
            <InfoList title="Risiken" items={result.comparison.risks} />
          ) : null}
          {result.comparison.recommendations.length > 0 ? (
            <InfoList title="Empfehlungen" items={result.comparison.recommendations} />
          ) : null}

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-accordion__summary">Erweitert: technischer Vergleich</summary>
            <pre className="dashboard-code-block dashboard-mt-14">{compactJson(result)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <strong>{title}</strong>
      <ul className="dashboard-list dashboard-no-margin-bottom">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
