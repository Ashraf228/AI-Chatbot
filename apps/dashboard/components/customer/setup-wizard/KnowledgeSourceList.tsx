import Link from "next/link";
import type { KnowledgeSource } from "./setupWizardTypes";
import { KnowledgeEmptyState } from "./KnowledgeEmptyState";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";

type KnowledgeSourceListProps = {
  siteSlug: string;
  sources: KnowledgeSource[];
  savingKey: string | null;
  onToggle: (source: KnowledgeSource) => void;
  onRefresh: (source: KnowledgeSource) => void;
  onRemove: (source: KnowledgeSource) => void;
  onAddClick?: () => void;
};

export function KnowledgeSourceList({
  siteSlug,
  sources,
  savingKey,
  onToggle,
  onRefresh,
  onRemove,
  onAddClick,
}: KnowledgeSourceListProps) {
  return (
    <div className="dashboard-stack dashboard-stack--sm knowledge-step__sources">
      <div className="dashboard-inline dashboard-inline--spaced dashboard-wrap">
        <h3 className="dashboard-card-title dashboard-card-title--sm">Wissensquellen</h3>
        <Link href={`/sites/${siteSlug}/knowledge`} className="dashboard-button dashboard-button--secondary">
          Alle Inhalte öffnen
        </Link>
      </div>
      {sources.length === 0 ? (
        <KnowledgeEmptyState onAddClick={onAddClick} />
      ) : (
        <div className="wizard-source-list">
          {sources.map((source) => (
            <KnowledgeSourceCard
              key={source.id}
              source={source}
              savingKey={savingKey}
              onToggle={onToggle}
              onRefresh={onRefresh}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
