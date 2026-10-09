"use client";

import { useEffect, useState } from "react";
import { Button } from "../../shared/Button";

type TestStatus = "aligned" | "partial" | "conflict" | "unknown";

type ConversationEngineTestCase = {
  id: string;
  name: string;
  message: string;
  expectedIntent?: string;
  expectedGoal?: string;
  expectedAgentKey?: string;
  resultStatus?: TestStatus;
  lastComparison?: Record<string, unknown>;
  responsePreview?: {
    enabled?: boolean;
    draftTextPreview?: string;
    mode?: string;
    nextActionLabel?: string;
    shouldAskQuestion?: boolean;
    shouldHandoff?: boolean;
    missingFields?: string[];
    confidence?: number;
    qualityStatus?: "good" | "needs_review" | "risky" | "unknown";
    qualityScore?: number;
    qualityFindings?: string[];
    qualityRisks?: string[];
    qualityRecommendations?: string[];
    groundingStatus?: "grounded" | "partially_grounded" | "ungrounded" | "not_required";
    groundingWarnings?: string[];
    usedKnowledgeSources?: Array<{ id?: string; title?: string; sourceType?: string; score?: number; excerpt?: string }>;
    knowledgeAttempted?: boolean;
    knowledgeStatus?: string;
    warnings?: string[];
  };
  responsePreviewSkippedReason?: string;
  lastRunAt?: string;
};

type TestMetrics = {
  total: number;
  aligned: number;
  partial: number;
  conflict: number;
  unknown: number;
  topConflictReasons?: Array<{ label: string; count: number }>;
  affectedIntents?: Array<{ label: string; count: number }>;
  affectedAgents?: Array<{ label: string; count: number }>;
  recommendations?: Array<{ label: string; count: number }>;
};

type TestCaseState = {
  settings: {
    previewEnabled: boolean;
    compareEnabled: boolean;
    responsePreviewEnabled: boolean;
    knowledgePreviewEnabled: boolean;
    adminTestOnly: true;
  };
  testCases: ConversationEngineTestCase[];
  metrics: TestMetrics;
  responseQualitySummary: {
    totalWithPreview: number;
    goodCount: number;
    needsReviewCount: number;
    riskyCount: number;
    unknownCount: number;
    averageQualityScore: number;
    lowestQualityScore: number | null;
    highestQualityScore: number | null;
    riskyTestCaseNames: string[];
    commonRisks?: Array<{ label: string; count: number }>;
    commonRecommendations?: Array<{ label: string; count: number }>;
  };
  knowledgeSummary: {
    totalAttempted: number;
    groundedCount: number;
    partiallyGroundedCount: number;
    ungroundedCount: number;
    noKnowledgeNeededCount: number;
    emptyKnowledgeCount: number;
    retrievalErrorCount: number;
    commonGroundingWarnings?: Array<{ label: string; count: number }>;
  };
  starterTestCases: Array<{ name: string; message: string }>;
};

type ConversationEngineTestCasesCardProps = {
  siteId: string;
};

const STATUS_LABELS: Record<TestStatus, string> = {
  aligned: "Passt",
  partial: "Teilweise passend",
  conflict: "Konflikt",
  unknown: "Unklar",
};

const STATUS_TONE: Record<TestStatus, string> = {
  aligned: "success",
  partial: "warning",
  conflict: "error",
  unknown: "pending",
};

const QUALITY_LABELS: Record<string, string> = {
  good: "Gut",
  needs_review: "Prüfen",
  risky: "Riskant",
  unknown: "Unklar",
};

const QUALITY_TONE: Record<string, string> = {
  good: "success",
  needs_review: "warning",
  risky: "error",
  unknown: "pending",
};

const GROUNDING_LABELS: Record<string, string> = {
  grounded: "Quellenbasiert",
  partially_grounded: "Teilweise belegt",
  ungrounded: "Keine passende Wissensbasis gefunden",
  not_required: "Nicht erforderlich",
};

function groundingLabel(value: string) {
  return GROUNDING_LABELS[value] || value;
}

function emptyState(): TestCaseState {
  return {
    settings: {
      previewEnabled: false,
      compareEnabled: false,
      responsePreviewEnabled: false,
      knowledgePreviewEnabled: false,
      adminTestOnly: true,
    },
    testCases: [],
    metrics: { total: 0, aligned: 0, partial: 0, conflict: 0, unknown: 0 },
    responseQualitySummary: {
      totalWithPreview: 0,
      goodCount: 0,
      needsReviewCount: 0,
      riskyCount: 0,
      unknownCount: 0,
      averageQualityScore: 0,
      lowestQualityScore: null,
      highestQualityScore: null,
      riskyTestCaseNames: [],
    },
    knowledgeSummary: {
      totalAttempted: 0,
      groundedCount: 0,
      partiallyGroundedCount: 0,
      ungroundedCount: 0,
      noKnowledgeNeededCount: 0,
      emptyKnowledgeCount: 0,
      retrievalErrorCount: 0,
    },
    starterTestCases: [],
  };
}

export function ConversationEngineTestCasesCard({ siteId }: ConversationEngineTestCasesCardProps) {
  const [state, setState] = useState<TestCaseState>(emptyState);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [expectedIntent, setExpectedIntent] = useState("");
  const [expectedGoal, setExpectedGoal] = useState("");
  const [expectedAgentKey, setExpectedAgentKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeResponsePreview, setIncludeResponsePreview] = useState(false);
  const [includeKnowledge, setIncludeKnowledge] = useState(false);

  async function loadState() {
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/test-cases`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as TestCaseState & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Testfälle konnten nicht geladen werden.");
      }
      setState({ ...emptyState(), ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testfälle konnten nicht geladen werden.");
    }
  }

  useEffect(() => {
    void loadState();
  }, [siteId]);

  async function updateSettings(next: Partial<TestCaseState["settings"]>) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...state.settings, ...next, adminTestOnly: true }),
      });
      const data = (await response.json().catch(() => ({}))) as TestCaseState & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Einstellungen konnten nicht gespeichert werden.");
      }
      setState({ ...emptyState(), ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setLoading(false);
    }
  }

  async function addTestCase(input?: { name: string; message: string }) {
    const nextName = input?.name || name;
    const nextMessage = input?.message || message;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/test-cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          message: nextMessage,
          expectedIntent,
          expectedGoal,
          expectedAgentKey,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as TestCaseState & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Testfall konnte nicht gespeichert werden.");
      }
      setState({ ...emptyState(), ...data });
      if (!input) {
        setName("");
        setMessage("");
        setExpectedIntent("");
        setExpectedGoal("");
        setExpectedAgentKey("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testfall konnte nicht gespeichert werden.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteTestCase(caseId: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/sites/${encodeURIComponent(siteId)}/conversation-engine/test-cases/${encodeURIComponent(caseId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json().catch(() => ({}))) as TestCaseState & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Testfall konnte nicht gelöscht werden.");
      }
      setState({ ...emptyState(), ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testfall konnte nicht gelöscht werden.");
    } finally {
      setLoading(false);
    }
  }

  async function runTestCases() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/test-cases/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeResponsePreview, includeKnowledge }),
      });
      const data = (await response.json().catch(() => ({}))) as TestCaseState & { message?: string };
      if (!response.ok) {
        throw new Error(data.message || "Testfälle konnten nicht ausgeführt werden.");
      }
      setState({ ...emptyState(), ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Testfälle konnten nicht ausgeführt werden.");
    } finally {
      setLoading(false);
    }
  }

  const metrics = state.metrics || emptyState().metrics;
  const responseQualitySummary = state.responseQualitySummary || emptyState().responseQualitySummary;
  const knowledgeSummary = state.knowledgeSummary || emptyState().knowledgeSummary;
  const canIncludeResponsePreview =
    state.settings.previewEnabled && state.settings.compareEnabled && state.settings.responsePreviewEnabled;
  const canIncludeKnowledge = canIncludeResponsePreview && state.settings.knowledgePreviewEnabled;

  return (
    <div className="setup-module-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Gesprächslogik Testfälle</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Nur Admin-Testmodus. Das Live-Widget bleibt unverändert und es werden keine Leads, Tickets, E-Mails oder
          Webhooks ausgelöst.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--split">
        <ToggleField
          label="Gesprächslogik-Vorschau aktivieren"
          checked={state.settings.previewEnabled}
          disabled={loading}
          onChange={(checked) => updateSettings({ previewEnabled: checked })}
        />
        <ToggleField
          label="Legacy-Vergleich aktivieren"
          checked={state.settings.compareEnabled}
          disabled={loading || !state.settings.previewEnabled}
          onChange={(checked) => updateSettings({ compareEnabled: checked })}
        />
        <ToggleField
          label="Antwortvorschau aktivieren"
          checked={state.settings.responsePreviewEnabled}
          disabled={loading || !state.settings.previewEnabled}
          onChange={(checked) => updateSettings({ responsePreviewEnabled: checked })}
        />
        <ToggleField
          label="Wissensbasis-Vorschau aktivieren"
          checked={state.settings.knowledgePreviewEnabled}
          disabled={loading || !state.settings.previewEnabled || !state.settings.responsePreviewEnabled}
          onChange={(checked) => updateSettings({ knowledgePreviewEnabled: checked })}
        />
        <ToggleField
          label="Antwortqualität mitprüfen"
          checked={includeResponsePreview}
          disabled={loading || !canIncludeResponsePreview}
          onChange={(checked) => setIncludeResponsePreview(checked)}
        />
        <ToggleField
          label="Antwort mit Wissensbasis prüfen"
          checked={includeKnowledge}
          disabled={loading || !canIncludeKnowledge}
          onChange={(checked) => setIncludeKnowledge(checked)}
        />
      </div>

      {error ? <div className="dashboard-status dashboard-status--error">{error}</div> : null}

      <div className="dashboard-grid dashboard-grid--metrics-4">
        <Metric label="Testfälle" value={metrics.total} />
        <Metric label="Passt" value={metrics.aligned} tone="success" />
        <Metric label="Konflikte" value={metrics.conflict} tone="error" />
        <Metric label="Unklar" value={metrics.unknown} tone="pending" />
      </div>

      {responseQualitySummary.totalWithPreview > 0 ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Antwortqualität</strong>
          <div className="dashboard-grid dashboard-grid--metrics-4">
            <Metric label="Geprüft" value={responseQualitySummary.totalWithPreview} />
            <Metric label="Gut" value={responseQualitySummary.goodCount} tone="success" />
            <Metric label="Prüfen" value={responseQualitySummary.needsReviewCount} tone="warning" />
            <Metric label="Riskant" value={responseQualitySummary.riskyCount} tone="error" />
          </div>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Durchschnittlicher Score: {responseQualitySummary.averageQualityScore}/100
            {responseQualitySummary.lowestQualityScore !== null
              ? ` · Niedrigster Score: ${responseQualitySummary.lowestQualityScore}/100`
              : ""}
          </p>
          {responseQualitySummary.riskyTestCaseNames.length > 0 ? (
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Riskante Testfälle: {responseQualitySummary.riskyTestCaseNames.join(", ")}
            </p>
          ) : null}
        </div>
      ) : includeResponsePreview && !canIncludeResponsePreview ? (
        <div className="dashboard-status dashboard-status--warning">
          Antwortqualität wird erst geprüft, wenn Vorschau, Vergleich und Antwortvorschau aktiv sind.
        </div>
      ) : null}

      {includeKnowledge && !canIncludeKnowledge ? (
        <div className="dashboard-status dashboard-status--pending">
          Wissensbasis-Vorschau ist noch nicht aktiviert.
        </div>
      ) : null}

      {knowledgeSummary.totalAttempted > 0 ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Wissensbasis-Prüfung</strong>
          <div className="dashboard-grid dashboard-grid--metrics-4">
            <Metric label="Versucht" value={knowledgeSummary.totalAttempted} />
            <Metric label="Quellenbasiert" value={knowledgeSummary.groundedCount} tone="success" />
            <Metric label="Teilweise" value={knowledgeSummary.partiallyGroundedCount} tone="warning" />
            <Metric label="Ohne Treffer" value={knowledgeSummary.ungroundedCount + knowledgeSummary.emptyKnowledgeCount} tone="pending" />
          </div>
          {knowledgeSummary.retrievalErrorCount > 0 ? (
            <div className="dashboard-status dashboard-status--error">
              Retrieval-Fehler: {knowledgeSummary.retrievalErrorCount}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <strong>Testfall hinzufügen</strong>
        <div className="dashboard-grid dashboard-grid--split">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Name</span>
            <input
              className="dashboard-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Supportfrage"
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Erwarteter Agent optional</span>
            <input
              className="dashboard-input"
              value={expectedAgentKey}
              onChange={(event) => setExpectedAgentKey(event.target.value)}
              placeholder="z. B. support-agent"
            />
          </label>
        </div>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Testnachricht</span>
          <textarea
            className="dashboard-textarea wizard-textarea-compact"
            rows={2}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ich brauche Hilfe, mein VPN funktioniert nicht."
          />
        </label>
        <div className="dashboard-grid dashboard-grid--split">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Erwartete Absicht optional</span>
            <input
              className="dashboard-input"
              value={expectedIntent}
              onChange={(event) => setExpectedIntent(event.target.value)}
              placeholder="support"
            />
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Erwartetes Ziel optional</span>
            <input
              className="dashboard-input"
              value={expectedGoal}
              onChange={(event) => setExpectedGoal(event.target.value)}
              placeholder="solve_problem"
            />
          </label>
        </div>
        <Button type="button" variant="secondary" onClick={() => addTestCase()} disabled={loading || !message.trim()}>
          Testfall hinzufügen
        </Button>
      </div>

      {state.testCases.length === 0 && state.starterTestCases.length > 0 ? (
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Starter-Testfälle</strong>
          <div className="dashboard-chip-row">
            {state.starterTestCases.map((testCase) => (
              <button
                className="dashboard-chip"
                type="button"
                key={testCase.message}
                onClick={() => addTestCase(testCase)}
                disabled={loading}
              >
                {testCase.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-stack dashboard-stack--sm">
        <div className="dashboard-actions-row">
          <Button
            type="button"
            variant="secondary"
            onClick={runTestCases}
            disabled={loading || state.testCases.length === 0 || !state.settings.previewEnabled || !state.settings.compareEnabled}
          >
            {loading ? "Auswertung läuft..." : "Testfälle ausführen"}
          </Button>
        </div>

        {state.testCases.map((testCase) => {
          const status = testCase.resultStatus || "unknown";
          return (
            <div className="dashboard-card dashboard-card--compact dashboard-stack dashboard-stack--sm" key={testCase.id}>
              <div className="dashboard-list-row">
                <div>
                  <strong>{testCase.name}</strong>
                  <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{testCase.message}</p>
                </div>
                <span className={`dashboard-status dashboard-status--${STATUS_TONE[status]}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              {testCase.lastComparison ? (
                <details>
                  <summary className="dashboard-accordion__summary">Letzter Vergleich</summary>
                  <pre className="dashboard-code-block dashboard-mt-14">
                    {JSON.stringify(testCase.lastComparison, null, 2)}
                  </pre>
                </details>
              ) : null}
              {testCase.responsePreview ? (
                <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                  <div className="dashboard-list-row">
                    <strong>Antwortentwurf</strong>
                    <span
                      className={`dashboard-status dashboard-status--${
                        QUALITY_TONE[testCase.responsePreview.qualityStatus || "unknown"] || "pending"
                      }`}
                    >
                      {QUALITY_LABELS[testCase.responsePreview.qualityStatus || "unknown"] || "Unklar"} ·{" "}
                      {testCase.responsePreview.qualityScore ?? 0}/100
                    </span>
                  </div>
                  <p className="dashboard-copy dashboard-no-margin-bottom">
                    {testCase.responsePreview.draftTextPreview || "Kein Antwortentwurf vorhanden."}
                  </p>
                  <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                    Nächste Aktion: {testCase.responsePreview.nextActionLabel || "nicht bestimmt"}
                    {testCase.responsePreview.shouldHandoff ? " · Übergabe vorgesehen" : ""}
                    {testCase.responsePreview.shouldAskQuestion ? " · Rückfrage vorgesehen" : ""}
                  </p>
                  {testCase.responsePreview.groundingStatus ? (
                    <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                      Wissensbasis: {groundingLabel(testCase.responsePreview.groundingStatus)}
                      {testCase.responsePreview.knowledgeStatus ? ` · Status ${testCase.responsePreview.knowledgeStatus}` : ""}
                    </p>
                  ) : null}
                  {(testCase.responsePreview.usedKnowledgeSources || []).length > 0 ? (
                    <ul className="dashboard-list dashboard-no-margin-bottom">
                      {(testCase.responsePreview.usedKnowledgeSources || []).slice(0, 3).map((source) => (
                        <li key={source.id || source.title}>
                          {source.title || "Wissensquelle"}
                          {typeof source.score === "number" ? ` · Score ${source.score}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {(testCase.responsePreview.qualityRisks || []).length > 0 ? (
                    <ul className="dashboard-list dashboard-no-margin-bottom">
                      {(testCase.responsePreview.qualityRisks || []).slice(0, 3).map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : testCase.responsePreviewSkippedReason ? (
                <div className="dashboard-status dashboard-status--pending">
                  Antwortvorschau übersprungen: {testCase.responsePreviewSkippedReason}
                </div>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => deleteTestCase(testCase.id)} disabled={loading}>
                Entfernen
              </Button>
            </div>
          );
        })}
      </div>

      <InsightList title="Häufigste Konfliktgründe" items={metrics.topConflictReasons || []} />
      <InsightList title="Betroffene Absichten" items={metrics.affectedIntents || []} />
      <InsightList title="Betroffene Agenten" items={metrics.affectedAgents || []} />
      <InsightList title="Empfehlungen" items={metrics.recommendations || []} />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="dashboard-toggle-row">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Metric({ label, value, tone = "pending" }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`dashboard-card dashboard-card--compact dashboard-status--${tone}`}>
      <strong>{value}</strong>
      <p className="dashboard-copy dashboard-no-margin-bottom">{label}</p>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div>
      <strong>{title}</strong>
      <ul className="dashboard-list dashboard-no-margin-bottom">
        {items.map((item) => (
          <li key={item.label}>
            {item.label} ({item.count})
          </li>
        ))}
      </ul>
    </div>
  );
}
