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
    return "Keine Wissenshinweise im internen Test verwendet.";
  }
  return turn.usedKnowledgeSnippets
    .map((snippet) => snippet.title || snippet.url || snippet.id || "Snippet")
    .join(", ");
}

function uniqueItems(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function resultTone(turn: InternalTestChatTurn) {
  const shouldHandoff = turn.result.runtimeState?.shouldHandoff || turn.result.conversationEnginePreview?.shouldHandoff;
  const shouldAskQuestion = turn.result.runtimeState?.shouldAskQuestion;
  const missingFields = turn.result.conversationEnginePreview?.missingFields || [];
  const sourceRequired = turn.result.runtimeState?.sourceRequired;
  const snippetsUsed = turn.usedKnowledgeSnippets.length > 0;

  if (!turn.assistantDraft.trim()) {
    return "error";
  }
  if (shouldHandoff) {
    return "warning";
  }
  if (shouldAskQuestion || missingFields.length > 0) {
    return "pending";
  }
  if (sourceRequired && !snippetsUsed) {
    return "warning";
  }
  return "success";
}

function resultLabel(turn: InternalTestChatTurn) {
  const shouldHandoff = turn.result.runtimeState?.shouldHandoff || turn.result.conversationEnginePreview?.shouldHandoff;
  const shouldAskQuestion = turn.result.runtimeState?.shouldAskQuestion;
  const missingFields = turn.result.conversationEnginePreview?.missingFields || [];
  const sourceRequired = turn.result.runtimeState?.sourceRequired;
  const snippetsUsed = turn.usedKnowledgeSnippets.length > 0;

  if (!turn.assistantDraft.trim()) {
    return "Keine belastbare Testantwort";
  }
  if (shouldHandoff) {
    return "Uebergabe empfohlen";
  }
  if (shouldAskQuestion || missingFields.length > 0) {
    return "Rueckfrage erforderlich";
  }
  if (sourceRequired && !snippetsUsed) {
    return "Wissen reicht fuer diese Frage noch nicht";
  }
  if (snippetsUsed) {
    return "Antwort mit Wissensbezug";
  }
  return "Antwortentwurf bereit";
}

function knowledgeSummary(turn: InternalTestChatTurn) {
  const retrieval = turn.result.knowledgeRetrieval;
  const reasons = retrieval?.reasons || [];
  const warnings = retrieval?.warnings || [];

  if (turn.usedKnowledgeSnippets.length > 0) {
    return `${turn.usedKnowledgeSnippets.length} Wissenshinweis${turn.usedKnowledgeSnippets.length === 1 ? "" : "e"} sichtbar.`;
  }
  if (retrieval?.status === "disabled") {
    return reasons[0] || "Knowledge-Retrieval in diesem Testpfad deaktiviert.";
  }
  if (retrieval?.status === "blocked") {
    return warnings[0] || reasons[0] || "Knowledge-Zugriff fuer diesen Testlauf blockiert.";
  }
  if (retrieval?.attempted) {
    return warnings[0] || reasons[0] || "Knowledge wurde angefragt, aber ohne nutzbaren Hinweis beendet.";
  }
  if (turn.result.runtimeState?.sourceRequired) {
    return "Diese Frage braucht Wissen, aber im Testlauf liegt kein nutzbarer Wissenshinweis vor.";
  }
  return "Kein Wissenshinweis fuer diesen Testlauf erforderlich oder geliefert.";
}

function conversationSummary(turn: InternalTestChatTurn) {
  const preview = turn.result.conversationEnginePreview;
  const runtime = turn.result.runtimeState;
  const parts = [
    preview?.intent ? `Intent: ${preview.intent}` : null,
    preview?.goal ? `Ziel: ${preview.goal}` : null,
    preview?.stage ? `Phase: ${preview.stage}` : null,
    runtime?.selectedAgentKey || preview?.selectedAgentKey
      ? `Agent: ${runtime?.selectedAgentKey || preview?.selectedAgentKey}`
      : null,
    turn.result.engineResponsePreview?.draft?.nextActionLabel || runtime?.nextActionKey || preview?.nextAction
      ? `Naechster Schritt: ${
          turn.result.engineResponsePreview?.draft?.nextActionLabel || runtime?.nextActionKey || preview?.nextAction
        }`
      : null,
  ];
  return uniqueItems(parts).join(" · ") || "Keine Gespraechslogik-Vorschau verfuegbar.";
}

function handoffSummary(turn: InternalTestChatTurn) {
  const shouldHandoff = turn.result.runtimeState?.shouldHandoff || turn.result.conversationEnginePreview?.shouldHandoff;
  const shouldAskQuestion = turn.result.runtimeState?.shouldAskQuestion;
  const missingFields = turn.result.conversationEnginePreview?.missingFields || [];

  if (shouldHandoff) {
    return "Runtime-Pilot markiert diesen Verlauf als Uebergabe-Fall. Keine echte Weiterleitung wurde ausgeloest.";
  }
  if (shouldAskQuestion && missingFields.length > 0) {
    return `Vor einer belastbaren Antwort fehlen noch Angaben: ${missingFields.join(", ")}.`;
  }
  if (shouldAskQuestion) {
    return "Vor einer belastbaren Antwort ist noch eine Rueckfrage noetig.";
  }
  if (missingFields.length > 0) {
    return `Fehlende Angaben erkannt: ${missingFields.join(", ")}.`;
  }
  return "Keine Uebergabe und keine fehlenden Pflichtangaben im aktuellen Testlauf.";
}

function safetySummary(turn: InternalTestChatTurn) {
  const activation = turn.result.activationBoundary;
  const sideEffects = turn.result.sideEffects;
  const parts = [
    activation?.publicWidgetActivation ? "oeffentliches Chatfenster aktiviert" : "oeffentliches Chatfenster aus",
    activation?.productionActivation ? "Produktivbetrieb aktiviert" : "Produktivbetrieb aus",
    activation?.deployRequired ? "Deploy waere noetig" : "kein Deploy noetig",
    sideEffects?.ticketDelivery ? "Ticket-Auslieferung aktiv" : "keine Ticket-Auslieferung",
    sideEffects?.emailDelivery ? "E-Mail-Auslieferung aktiv" : "keine E-Mail-Auslieferung",
    sideEffects?.webhookDelivery ? "Webhook-Auslieferung aktiv" : "keine Webhook-Auslieferung",
    sideEffects?.providerCalls ? "Provider Calls aktiv" : "keine Provider Calls",
    sideEffects?.queryRunner ? "Query Runner aktiv" : "kein Query Runner",
  ];
  return parts.join(" · ");
}

function visibleWarnings(turn: InternalTestChatTurn) {
  return uniqueItems([...(turn.result.warnings || []), ...(turn.result.reasons || []), ...(turn.result.knowledgeRetrieval?.warnings || [])]);
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
          Interner Admin-/Operator-Test auf Basis des zuletzt gespeicherten Einrichtungsstands. Kein oeffentliches
          Chatfenster, kein Deploy, kein Produktivbetrieb und keine echten Tickets, E-Mails oder Webhooks.
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-2">
        <CompactMetricCard label="Getesteter Setup-Stand" value={setupContextLabel(site)} />
        <CompactMetricCard label="Wissensstatus" value={knowledgeLabel} />
        <CompactMetricCard
          label="Sicherheitsgrenze"
          value="Tickets, E-Mails, Webhooks, Provider Calls, Query Runner und Deploy bleiben ausgeschaltet."
        />
        <CompactMetricCard
          label="Testverlauf"
          value="Der Test-Transcript bleibt lokal im Browser-State. Es wird keine produktive Chat-History gespeichert."
        />
      </div>

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
        Der interne Test nutzt die gespeicherte KI-Mitarbeiter-Konfiguration und Gespraechslogik. Im technischen
        Diagnosepfad laeuft das ueber den Runtime-Pilot. Persistierte Wissensquellen werden hier transparent als
        Bereitschaftsstatus gezeigt; ohne separaten Retrieval-Pfad werden keine Rohinhalte aus der bestehenden
        Wissensbasis in diesen Testchat eingespeist.
      </p>

      {!canUseTestTools ? (
        <div className="dashboard-status dashboard-status--info">
          Der interne Testchat ist nur für Admins und Operatoren sichtbar. Viewer sehen hier keine internen Testfunktionen.
        </div>
      ) : (
        <>
          <div className="launch-step__composer">
            <div className="dashboard-inline dashboard-wrap">
              {PRESET_QUESTIONS.map((question) => (
                <Button key={question} type="button" variant="secondary" onClick={() => onChangeInput(question)}>
                  {question}
                </Button>
              ))}
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

            <div className="dashboard-inline dashboard-wrap">
              <Button type="button" onClick={onSend} disabled={isLoading || !input.trim()}>
                {isLoading ? "Interner Test läuft..." : "Interne Testfrage senden"}
              </Button>
              <Button type="button" variant="ghost" onClick={onClear} disabled={isLoading || turns.length === 0}>
                Lokalen Transcript leeren
              </Button>
            </div>
          </div>

          <div className="launch-step__transcript">
            <div className="launch-step__transcript-header">
              <strong>Lokaler Testverlauf</strong>
              <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                Letzter lokaler Test: {formatDate(latestTestedAt)}
              </p>
            </div>

            <div className="launch-step__messages dashboard-stack dashboard-stack--sm">
            {turns.length === 0 ? (
              <EmptyStateCard
                title="Noch kein interner Test"
                description="Stelle eine Testfrage, um Hauptantwort, Operator-Auswertung, Knowledge-Status und Side-Effect-Grenzen gegen den gespeicherten Setup-Stand zu pruefen."
              />
            ) : (
              turns.map((turn, index) => (
                <div key={turn.id} className="dashboard-card dashboard-card--compact launch-step__message dashboard-stack dashboard-stack--sm">
                  <div>
                    <strong>Testfrage {index + 1}</strong>
                    <p className="dashboard-copy dashboard-no-margin-bottom">{turn.userMessage}</p>
                  </div>
                  <div>
                    <div className="dashboard-inline dashboard-wrap">
                      <span className={`dashboard-status dashboard-status--${resultTone(turn)}`}>{resultLabel(turn)}</span>
                      <span className="dashboard-badge">Interner Test ohne Livegang</span>
                    </div>
                  </div>
                  <div>
                    <strong>Hauptantwort</strong>
                    <p className="dashboard-copy dashboard-no-margin-bottom">{safeMessageText(turn.assistantDraft)}</p>
                  </div>
                  <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
                    <strong>Operator-Auswertung</strong>
                    <div className="dashboard-grid dashboard-grid--metrics-2">
                      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                        <strong>Knowledge-Status</strong>
                        <p className="dashboard-copy dashboard-no-margin-bottom">{knowledgeSummary(turn)}</p>
                        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                          Knowledge im Test genutzt: {usedKnowledgeLabel(turn)}
                        </p>
                      </div>
                      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                        <strong>Gespraechslogik</strong>
                        <p className="dashboard-copy dashboard-no-margin-bottom">{conversationSummary(turn)}</p>
                      </div>
                      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                        <strong>Uebergabe & fehlende Angaben</strong>
                        <p className="dashboard-copy dashboard-no-margin-bottom">{handoffSummary(turn)}</p>
                      </div>
                      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
                        <strong>Side-Effect-Grenze</strong>
                        <p className="dashboard-copy dashboard-no-margin-bottom">{safetySummary(turn)}</p>
                      </div>
                    </div>
                  </div>
                  {visibleWarnings(turn).length ? (
                    <div className="dashboard-stack dashboard-stack--xs">
                      {visibleWarnings(turn).map((warning) => (
                        <p key={warning} className="dashboard-status dashboard-status--warning">
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <details className="dashboard-card dashboard-card--soft">
                    <summary className="dashboard-copy">Technische Diagnose (optional)</summary>
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
                      {visibleWarnings(turn).length ? (
                        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
                          Hinweise: {visibleWarnings(turn).join(" | ")}
                        </p>
                      ) : null}
                    </div>
                  </details>
                </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
