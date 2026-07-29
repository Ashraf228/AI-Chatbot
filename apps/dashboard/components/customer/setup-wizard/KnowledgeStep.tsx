import { getKnowledgeModeLabel } from "../../../lib/labels";
import { CompactMetricCard } from "../../shared/CompactMetricCard";
import type { CustomerStatusTone } from "../customer-status";
import { KnowledgeAddSourcePanel } from "./KnowledgeAddSourcePanel";
import { KnowledgeSourceList } from "./KnowledgeSourceList";
import type { KnowledgeDraftForm, KnowledgeMethod, KnowledgeMode, KnowledgeSource } from "./setupWizardTypes";
import { SetupStepHeader } from "./SetupStepHeader";

type KnowledgeStepProps = {
  siteSlug: string;
  sources: KnowledgeSource[];
  readyActiveSources: KnowledgeSource[];
  knowledgeMode: KnowledgeMode;
  selectedMethod: KnowledgeMethod;
  onMethodChange: (method: KnowledgeMethod) => void;
  draft: KnowledgeDraftForm;
  onDraftChange: (draft: KnowledgeDraftForm) => void;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  savingKey: string | null;
  onAddManual: () => void;
  onAddUrl: () => void;
  onAddPdf: () => void;
  onToggleSource: (source: KnowledgeSource) => void;
  onRefreshSource: (source: KnowledgeSource) => void;
  onRemoveSource: (source: KnowledgeSource) => void;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
  canContinue: boolean;
  continueHint: string;
};

export function KnowledgeStep({
  siteSlug,
  sources,
  readyActiveSources,
  knowledgeMode,
  selectedMethod,
  onMethodChange,
  draft,
  onDraftChange,
  selectedFile,
  onFileChange,
  savingKey,
  onAddManual,
  onAddUrl,
  onAddPdf,
  onToggleSource,
  onRefreshSource,
  onRemoveSource,
  explanation,
  status,
  statusLabel,
  canContinue,
  continueHint,
}: KnowledgeStepProps) {
  const normalizedStatus = (source: KnowledgeSource) => (source.status || "").toLowerCase();
  const failedSources = sources.filter((source) => {
    const value = normalizedStatus(source);
    return value === "failed" || value === "error";
  });
  const processingSources = sources.filter((source) => {
    const value = normalizedStatus(source);
    return value === "pending" || value === "processing";
  });
  const inactiveSources = sources.filter((source) => !source.isActive || normalizedStatus(source) === "disabled");
  const readyInactiveSources = sources.filter((source) => {
    const value = normalizedStatus(source);
    return !source.isActive && (value === "ready" || value === "indexed");
  });
  const sourceLabel = (count: number) => `Wissensquelle${count === 1 ? "" : "n"}`;
  const sourceVerb = (count: number) => (count === 1 ? "ist" : "sind");
  const persistedLabel =
    sources.length > 0
      ? `${sources.length} ${sourceLabel(sources.length)} ${sourceVerb(sources.length)} im bestehenden Produktpfad gespeichert.`
      : "Noch keine persistente Wissensquelle gespeichert.";
  const processingLabel =
    failedSources.length > 0
      ? `${failedSources.length} ${sourceLabel(failedSources.length)} ${sourceVerb(failedSources.length)} fehlerhaft und ${failedSources.length === 1 ? "muss" : "müssen"} korrigiert oder entfernt werden.`
      : processingSources.length > 0
        ? `${processingSources.length} ${sourceLabel(processingSources.length)} ${processingSources.length === 1 ? "wird" : "werden"} noch verarbeitet.`
        : readyActiveSources.length > 0
          ? `${readyActiveSources.length} aktive ${sourceLabel(readyActiveSources.length)} ${sourceVerb(readyActiveSources.length)} einsatzbereit.`
          : sources.length > 0
            ? "Quellen sind gespeichert, aber noch nicht einsatzbereit."
            : "Noch keine Verarbeitung gestartet.";
  const testchatLabel =
    readyActiveSources.length > 0
      ? `Ja. ${readyActiveSources.length} aktive ${sourceLabel(readyActiveSources.length)} ${readyActiveSources.length === 1 ? "kann" : "können"} im internen Testchat verwendet werden.`
      : inactiveSources.length > 0 && sources.length === inactiveSources.length
        ? "Noch nicht. Aktiviere mindestens eine Quelle, damit der Testchat Kundenwissen verwenden kann."
        : "Noch nicht. Ohne aktive, einsatzbereite Quelle nutzt der Testchat kein Kundenwissen.";
  const completionLabel = canContinue
    ? "Wissensschritt ist fuer Review & internen Test freigegeben."
    : continueHint;
  const persistenceBoundaryLabel =
    sources.length > 0
      ? "Diese Liste zeigt nur persistent gespeicherte Quellen aus dem bestehenden Produktpfad. Demo-, In-Memory- oder request-lokale Testdaten zaehlen hier nicht."
      : "Noch keine persistente Quelle vorhanden. Demo-, In-Memory- oder request-lokale Testdaten wuerden hier ebenfalls nicht als gespeichert erscheinen.";
  const websiteBoundaryLabel =
    "Die Website oder Domain aus dem Kundenprofil ist nur Stammdatum. Sie wird nicht automatisch als Wissensquelle gecrawlt oder aktiviert.";
  const completionBreakdownLabel =
    readyActiveSources.length > 0
      ? `${readyActiveSources.length} aktive ready-Quelle${readyActiveSources.length === 1 ? "" : "n"} zaehlen aktuell fuer die Einrichtung.`
      : "Noch keine aktive ready-Quelle zaehlt fuer die Einrichtung.";

  return (
    <section className="dashboard-card dashboard-stack knowledge-step" id="setup-step-knowledge">
      <SetupStepHeader
        title="Wissen"
        description="Fuege Inhalte hinzu, damit der KI-Mitarbeiter verlaesslichere Antworten formulieren kann."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <div className="dashboard-grid dashboard-grid--metrics-3">
        <CompactMetricCard label="Einträge gesamt" value={sources.length} />
        <CompactMetricCard label="Einsatzbereit" value={readyActiveSources.length} />
        <CompactMetricCard label="Antwortverhalten" value={getKnowledgeModeLabel(knowledgeMode)} />
      </div>
      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
        <h3 className="dashboard-card-title dashboard-card-title--sm">Save-and-Continue-Status</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Dieser Einrichtungsschritt nutzt nur den bestehenden Produktpfad. Demo-/In-Memory-Wissen aus anderen
          Bereichen zaehlt hier nicht als Abschluss.
        </p>
        <div className="dashboard-grid dashboard-grid--metrics-3">
          <CompactMetricCard label="Gespeichert" value={persistedLabel} />
          <CompactMetricCard label="Bereit" value={`${readyActiveSources.length} aktiv einsatzbereit`} />
          <CompactMetricCard label="In Verarbeitung" value={`${processingSources.length}`} />
          <CompactMetricCard label="Fehlerhaft" value={`${failedSources.length}`} />
          <CompactMetricCard label="Verarbeitung" value={processingLabel} />
          <CompactMetricCard label="Testchat" value={testchatLabel} />
          <CompactMetricCard label="Weiter zum Review" value={canContinue ? "Freigegeben" : "Noch blockiert"} />
        </div>
        <div className="dashboard-grid dashboard-grid--metrics-2">
          <CompactMetricCard label="Persistenzgrenze" value={persistenceBoundaryLabel} />
          <CompactMetricCard label="Completion-Regel" value={completionBreakdownLabel} />
          <CompactMetricCard
            label="Inaktive Quellen"
            value={
              readyInactiveSources.length > 0
                ? `${readyInactiveSources.length} ready-Quelle${readyInactiveSources.length === 1 ? "" : "n"} ${readyInactiveSources.length === 1 ? "ist" : "sind"} gespeichert, aber nicht aktiv.`
                : inactiveSources.length > 0
                  ? `${inactiveSources.length} Quelle${inactiveSources.length === 1 ? "" : "n"} ${inactiveSources.length === 1 ? "ist" : "sind"} derzeit nicht aktiv.`
                  : "Keine inaktive Quelle vorhanden."
            }
          />
          <CompactMetricCard label="Website-Grenze" value={websiteBoundaryLabel} />
        </div>
        <p className={`dashboard-status ${canContinue ? "dashboard-status--success" : "dashboard-status--info"}`}>{continueHint}</p>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{completionLabel}</p>
      </div>
      <KnowledgeAddSourcePanel
        method={selectedMethod}
        onMethodChange={onMethodChange}
        draft={draft}
        onDraftChange={onDraftChange}
        selectedFile={selectedFile}
        onFileChange={onFileChange}
        savingKey={savingKey}
        onAddManual={onAddManual}
        onAddUrl={onAddUrl}
        onAddPdf={onAddPdf}
      />
      <KnowledgeSourceList
        siteSlug={siteSlug}
        sources={sources}
        savingKey={savingKey}
        onToggle={onToggleSource}
        onRefresh={onRefreshSource}
        onRemove={onRemoveSource}
        onAddClick={() => onMethodChange("manual")}
      />
    </section>
  );
}
