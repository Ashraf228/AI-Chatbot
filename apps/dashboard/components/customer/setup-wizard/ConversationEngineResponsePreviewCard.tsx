"use client";

import { useState } from "react";
import { Button } from "../../shared/Button";

type ConversationDecision = {
  intent: string;
  goal: string;
  selectedAgentKey: string | null;
  nextAction: string;
  missingFields: string[];
  shouldHandoff: boolean;
  confidence: number;
};

type EngineResponsePreview = {
  enabled: boolean;
  draft: null | {
    text: string;
    mode: string;
    usedKnowledge: boolean;
    usedKnowledgeSources: Array<{ id?: string; title?: string; type?: string }>;
    askedQuestion?: string;
    nextActionLabel: string;
    shouldShowSources: boolean;
    shouldAskQuestion: boolean;
    shouldHandoff: boolean;
    missingFields: string[];
    confidence: number;
  };
  quality: null | {
    status: "good" | "needs_review" | "risky" | "unknown";
    score: number;
    findings: string[];
    risks: string[];
    recommendations: string[];
  };
  safety: {
    noSideEffects: true;
    publicWidgetUnaffected: true;
    integrationsSuppressed: true;
    sanitized: true;
  };
  warnings: string[];
  reasons: string[];
};

type ResponsePreviewResponse = {
  responsePreviewEnabled?: boolean;
  conversationEnginePreview: ConversationDecision | null;
  engineResponsePreview: EngineResponsePreview | null;
  legacy?: null | {
    route: string;
    replyPreview: string;
    warnings: string[];
  };
  comparison?: null | {
    status: "aligned" | "partial" | "conflict" | "unknown";
    findings: string[];
    risks: string[];
    recommendations: string[];
  };
};

type ConversationEngineResponsePreviewCardProps = {
  siteId: string;
};

const QUALITY_LABELS: Record<string, string> = {
  good: "Gut",
  needs_review: "Prüfen",
  risky: "Risiko",
  unknown: "Unklar",
};

const QUALITY_TONE: Record<string, string> = {
  good: "success",
  needs_review: "warning",
  risky: "error",
  unknown: "pending",
};

function compactJson(value: ResponsePreviewResponse) {
  return JSON.stringify(value, null, 2);
}

export function ConversationEngineResponsePreviewCard({ siteId }: ConversationEngineResponsePreviewCardProps) {
  const [message, setMessage] = useState("");
  const [includeLegacyCompare, setIncludeLegacyCompare] = useState(true);
  const [result, setResult] = useState<ResponsePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/response-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, includeLegacyCompare }),
      });
      const data = (await response.json().catch(() => ({}))) as ResponsePreviewResponse & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Antwortvorschau konnte nicht geladen werden.");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Antwortvorschau konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  const draft = result?.engineResponsePreview?.draft || null;
  const quality = result?.engineResponsePreview?.quality || null;
  const tone = quality ? QUALITY_TONE[quality.status] || "pending" : "pending";

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">KI-Mitarbeiter Antwortvorschau</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Nur Testmodus – das Live-Widget bleibt unverändert. Es werden keine Leads, Tickets, E-Mails oder Webhooks ausgelöst.
        </p>
      </div>

      <label className="dashboard-field">
        <span className="dashboard-field-label">Testnachricht</span>
        <textarea
          className="dashboard-textarea wizard-textarea-compact"
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Beispiel: Ich brauche Hilfe, mein VPN funktioniert nicht."
        />
      </label>

      <label className="dashboard-toggle-row">
        <input
          type="checkbox"
          checked={includeLegacyCompare}
          onChange={(event) => setIncludeLegacyCompare(event.target.checked)}
        />
        <span>Legacy-Vergleich zusätzlich anzeigen</span>
      </label>

      <Button type="button" variant="secondary" onClick={runPreview} disabled={loading || !message.trim()}>
        {loading ? "Simulation läuft..." : "Antwort simulieren"}
      </Button>

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      {result?.responsePreviewEnabled === false ? (
        <div className="dashboard-status dashboard-status--pending">
          Antwortvorschau ist deaktiviert. Aktivieren Sie responsePreviewEnabled im Admin-Testmodus.
        </div>
      ) : null}

      {draft && result?.conversationEnginePreview ? (
        <div className="dashboard-stack dashboard-stack--sm">
          <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
            <strong>Neue Antwort</strong>
            <p className="dashboard-copy dashboard-no-margin-bottom">{draft.text}</p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Nächste Aktion: {draft.nextActionLabel}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Fehlende Informationen: {draft.missingFields.length > 0 ? draft.missingFields.join(", ") : "keine"}
            </p>
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Quellenhinweis: {draft.shouldShowSources ? "anzeigen" : "nicht anzeigen"} · Übergabe:{" "}
              {draft.shouldHandoff ? "ja" : "nein"}
            </p>
          </div>

          <div className="dashboard-grid dashboard-grid--metrics-3">
            <Metric label="Absicht" value={result.conversationEnginePreview.intent} />
            <Metric label="Ziel" value={result.conversationEnginePreview.goal} />
            <Metric label="Agent" value={result.conversationEnginePreview.selectedAgentKey || "kein Agent"} />
          </div>

          {quality ? (
            <div className={`dashboard-status dashboard-status--${tone}`}>
              Qualitätsprüfung: {QUALITY_LABELS[quality.status] || quality.status} ({quality.score}/100)
            </div>
          ) : null}

          {quality?.findings.length ? <InfoList title="Hinweise" items={quality.findings} /> : null}
          {quality?.risks.length ? <InfoList title="Risiken" items={quality.risks} /> : null}
          {quality?.recommendations.length ? <InfoList title="Empfehlungen" items={quality.recommendations} /> : null}

          {result.legacy && result.comparison ? (
            <div className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm">
              <strong>Vergleich</strong>
              <p className="dashboard-copy dashboard-no-margin-bottom">
                Legacy-Route: {result.legacy.route} · Status: {result.comparison.status}
              </p>
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{result.legacy.replyPreview}</p>
            </div>
          ) : null}

          <details className="dashboard-card dashboard-card--soft">
            <summary className="dashboard-accordion__summary">Erweitert: technische Antwortvorschau</summary>
            <pre className="dashboard-code-block dashboard-mt-14">{compactJson(result)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-card dashboard-card--compact">
      <strong>{label}</strong>
      <p className="dashboard-copy dashboard-no-margin-bottom">{value}</p>
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
