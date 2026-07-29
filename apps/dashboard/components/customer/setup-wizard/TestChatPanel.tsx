import { Button } from "../../shared/Button";
import { CompactMetricCard } from "../../shared/CompactMetricCard";
import { EmptyStateCard } from "../../shared/EmptyStateCard";
import { formatDate } from "./setupWizardFormatters";
import type { InternalTestChatTurn, KnowledgeSource, SiteDetails } from "./setupWizardTypes";

type TestChatPanelProps = {
  site: SiteDetails;
  sources: KnowledgeSource[];
  readyActiveSources: KnowledgeSource[];
  processingSources: KnowledgeSource[];
  failedSources: KnowledgeSource[];
  turns: InternalTestChatTurn[];
  input: string;
  isLoading: boolean;
  canUseTestTools: boolean;
  onChangeInput: (value: string) => void;
  onSend: () => void;
  onClear: () => void;
};

const PRESET_QUESTIONS = [
  "Was kostet eine Rohrreinigung?",
  "Welche Informationen braucht ihr für eine Anfrage?",
  "Ich möchte zurückgerufen werden.",
];

const REDACTED_VALUES = new Set(["[DATEN BEREINIGT]", "[TESTDATEN BEREINIGT]", "[REDACTED]", "null", "undefined"]);

function safeMessageText(value: string) {
  return REDACTED_VALUES.has(value.trim()) ? "Diese Antwort wurde bereinigt." : value;
}

function knowledgeStatusLabel(
  sources: KnowledgeSource[],
  readyActiveSources: KnowledgeSource[],
  processingSources: KnowledgeSource[],
  failedSources: KnowledgeSource[],
) {
  if (failedSources.length > 0) {
    return `${failedSources.length} Quelle${failedSources.length === 1 ? "" : "n"} fehlerhaft. Test bleibt intern, Wissen ist noch nicht vollständig bereit.`;
  }
  if (processingSources.length > 0) {
    return `${processingSources.length} Quelle${processingSources.length === 1 ? "" : "n"} noch in Verarbeitung. Kein fertiger Wissenszustand behauptet.`;
  }
  if (readyActiveSources.length > 0) {
    return `${readyActiveSources.length} aktive ready-Quelle${readyActiveSources.length === 1 ? "" : "n"} vorhanden.`;
  }
  if (sources.length > 0) {
    return "Quellen gespeichert, aber keine aktive ready-Quelle verfügbar.";
  }
  return "Noch keine nutzbare Wissensquelle gespeichert.";
}

function setupContextLabel(site: SiteDetails) {
  const parts = [
    site.botName || site.name,
    site.primaryGoal || site.setupGoal || "Ziel noch unvollständig",
    site.knowledgeMode ? `Wissensmodus: ${site.knowledgeMode}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function usedKnowledgeLabel(turn: InternalTestChatTurn) {
  if (turn.usedKnowledgeSnippets.length === 0) {
    return "Keine Knowledge-Snippets im Runtime-Pilot verwendet.";
  }
  return turn.usedKnowledgeSnippets
    .map((snippet) => snippet.title || snippet.url || snippet.id || "Snippet")
    .join(", ");
}

export function TestChatPanel({
  site,
  sources,
  readyActiveSources,
  processingSources,
  failedSources,
  turns,
  input,
  isLoading,
  canUseTestTools,
  onChangeInput,
  onSend,
  onClear,
}: TestChatPanelProps) {
  const latestTurn = turns.at(-1);
  const latestTestedAt = latestTurn?.testedAt || "";
  const knowledgeLabel = knowledgeStatusLabel(sources, readyActiveSources, processingSources, failedSources);

  return (
    <div className="setup-module-card launch-step__panel launch-step__test-chat dashboard-stack dashboard-stack--sm" id="customer-test-chat">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Interner Testchat</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Admin-/Operator-Testmodus auf Basis des zuletzt gespeicherten Setup-Stands. Kein Public Widget, kein Deploy, keine
          Production-Aktivierung und keine echten Tickets, E-Mails oder Webhooks.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-2">
        <CompactMetricCard label="Getesteter Setup-Stand" value={setupContextLabel(site)} />
        <CompactMetricCard label="Wissensstatus" value={knowledgeLabel} />
        <CompactMetricCard
          label="Side-Effect-Grenze"
          value="Tickets, E-Mails, Webhooks, Provider Calls, Query Runner und Deploy bleiben ausgeschaltet."
        />
        <CompactMetricCard
          label="Transcript"
          value="Der Test-Transcript bleibt lokal im Browser-State. Es wird keine produktive Chat-History gespeichert."
        />
      </div>

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
        Der Runtime-Pilot nutzt die gespeicherte Agent-Konfiguration und Gesprächslogik. Persistierte Wissensquellen werden
        hier transparent als Bereitschaftsstatus gezeigt; ohne separaten Retrieval-Pfad werden keine Rohinhalte aus der
        bestehenden Wissensbasis in diesen Testchat eingespeist.
      </p>

      {!canUseTestTools ? (
        <div className="dashboard-status dashboard-status--info">
          Der interne Testchat ist nur für Admins und Operatoren sichtbar. Viewer sehen hier keine internen Testfunktionen.
        </div>
      ) : (
        <>
          <div className="dashboard-inline dashboard-wrap">
            {PRESET_QUESTIONS.map((question) => (
              <Button key={question} type="button" variant="secondary" onClick={() => onChangeInput(question)}>
                {question}
              </Button>
            ))}
          </div>

          <div className="dashboard-inline dashboard-wrap">
            <Button type="button" onClick={onSend} disabled={isLoading || !input.trim()}>
              {isLoading ? "Interner Test läuft..." : "Interne Testfrage senden"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClear} disabled={isLoading || turns.length === 0}>
              Lokalen Transcript leeren
            </Button>
          </div>

          <label className="dashboard-field">
            <span className="dashboard-field-label">Interne Testfrage</span>
            <textarea
              className="dashboard-textarea wizard-textarea-compact"
              rows={2}
              value={input}
              onChange={(event) => onChangeInput(event.target.value)}
              placeholder="Frage eingeben, die intern gegen die aktuelle Setup-Konfiguration geprüft werden soll"
            />
          </label>

          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            Letzter lokaler Test: {formatDate(latestTestedAt)}
          </p>

          <div className="launch-step__messages dashboard-stack dashboard-stack--sm">
            {turns.length === 0 ? (
              <EmptyStateCard
                title="Noch kein interner Test"
                description="Stelle eine Testfrage, um Antwortentwurf, Knowledge-Hinweise und Side-Effect-Grenzen gegen den gespeicherten Setup-Stand zu prüfen."
              />
            ) : (
              turns.map((turn, index) => (
                <div key={turn.id} className="dashboard-card dashboard-card--compact launch-step__message dashboard-stack dashboard-stack--sm">
                  <div>
                    <strong>Testfrage {index + 1}</strong>
                    <p className="dashboard-copy dashboard-no-margin-bottom">{turn.userMessage}</p>
                  </div>
                  <div>
                    <strong>Antwortentwurf</strong>
                    <p className="dashboard-copy dashboard-no-margin-bottom">{safeMessageText(turn.assistantDraft)}</p>
                  </div>
                  <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                    Knowledge im Test genutzt: {usedKnowledgeLabel(turn)}
                  </p>
                  <details className="dashboard-card dashboard-card--soft">
                    <summary className="dashboard-copy">Technische Details (optional)</summary>
                    <div className="dashboard-stack dashboard-stack--xs">
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        intent={turn.result.conversationEnginePreview?.intent || "unknown"} · goal=
                        {turn.result.conversationEnginePreview?.goal || "unknown"} · stage=
                        {turn.result.conversationEnginePreview?.stage || "unknown"}
                      </p>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        agent=
                        {turn.result.runtimeState?.selectedAgentKey || turn.result.conversationEnginePreview?.selectedAgentKey || "kein Agent"} ·
                        nextAction=
                        {turn.result.runtimeState?.nextActionKey || turn.result.conversationEnginePreview?.nextAction || "keine"}
                      </p>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        Missing Fields: {turn.result.conversationEnginePreview?.missingFields?.length ? turn.result.conversationEnginePreview.missingFields.join(", ") : "keine"}
                      </p>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        Activation Boundary: publicWidgetActivation=
                        {String(turn.result.activationBoundary?.publicWidgetActivation ?? false)} · productionActivation=
                        {String(turn.result.activationBoundary?.productionActivation ?? false)} · deployRequired=
                        {String(turn.result.activationBoundary?.deployRequired ?? false)}
                      </p>
                      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                        Side Effects: ticket={String(turn.result.sideEffects?.ticketDelivery ?? false)} · email=
                        {String(turn.result.sideEffects?.emailDelivery ?? false)} · webhook=
                        {String(turn.result.sideEffects?.webhookDelivery ?? false)} · provider=
                        {String(turn.result.sideEffects?.providerCalls ?? false)} · queryRunner=
                        {String(turn.result.sideEffects?.queryRunner ?? false)}
                      </p>
                      {turn.result.warnings?.length ? (
                        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                          Hinweise: {turn.result.warnings.join(" | ")}
                        </p>
                      ) : null}
                    </div>
                  </details>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
