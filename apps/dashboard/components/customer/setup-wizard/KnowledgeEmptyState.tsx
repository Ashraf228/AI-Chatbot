import { EmptyStateCard } from "../../shared/EmptyStateCard";

type KnowledgeEmptyStateProps = {
  onAddClick?: () => void;
};

export function KnowledgeEmptyState({ onAddClick }: KnowledgeEmptyStateProps) {
  return (
    <div className="knowledge-step__empty">
      <EmptyStateCard
        title="Wissen fehlt noch"
        description="Füge Dokumente oder Website-Inhalte hinzu, damit der Assistent bessere Antworten geben kann."
      />
      {onAddClick ? (
        <button type="button" className="dashboard-button dashboard-button--secondary" onClick={onAddClick}>
          Wissen hinzufügen
        </button>
      ) : null}
    </div>
  );
}
