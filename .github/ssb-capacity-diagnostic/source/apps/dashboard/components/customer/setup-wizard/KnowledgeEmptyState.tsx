import { EmptyStateCard } from "../../shared/EmptyStateCard";

type KnowledgeEmptyStateProps = {
  onAddClick?: () => void;
};

export function KnowledgeEmptyState({ onAddClick }: KnowledgeEmptyStateProps) {
  return (
    <div className="knowledge-step__empty">
      <EmptyStateCard
        title="Wissen fehlt noch"
        description="Fuege Texte, PDFs oder einzelne Webseiten als Wissensquellen hinzu. Die Website aus dem Kundenprofil wird dabei nicht automatisch gecrawlt."
      />
      {onAddClick ? (
        <button type="button" className="dashboard-button dashboard-button--secondary" onClick={onAddClick}>
          Wissen hinzufügen
        </button>
      ) : null}
    </div>
  );
}
