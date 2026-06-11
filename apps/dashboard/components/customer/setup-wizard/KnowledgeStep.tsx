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
}: KnowledgeStepProps) {
  return (
    <section className="dashboard-card dashboard-stack knowledge-step" id="setup-step-knowledge">
      <SetupStepHeader
        title="Wissen"
        description="Füge Inhalte hinzu, damit der Assistent bessere Antworten formulieren kann."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <div className="dashboard-grid dashboard-grid--metrics-3">
        <CompactMetricCard label="Einträge gesamt" value={sources.length} />
        <CompactMetricCard label="Einsatzbereit" value={readyActiveSources.length} />
        <CompactMetricCard label="Antwortverhalten" value={getKnowledgeModeLabel(knowledgeMode)} />
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
