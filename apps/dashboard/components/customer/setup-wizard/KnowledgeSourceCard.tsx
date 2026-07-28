import { Button } from "../../shared/Button";
import { CustomerStatusBadge } from "../CustomerStatusBadge";
import {
  formatKnowledgeSourceStatus,
  formatKnowledgeSourceType,
  formatKnowledgeSourceUpdatedAt,
} from "./setupWizardFormatters";
import type { KnowledgeSource } from "./setupWizardTypes";
import { sourceTone } from "./setupWizardValidation";

type KnowledgeSourceCardProps = {
  source: KnowledgeSource;
  savingKey: string | null;
  onToggle: (source: KnowledgeSource) => void;
  onRefresh: (source: KnowledgeSource) => void;
  onRemove: (source: KnowledgeSource) => void;
};

export function KnowledgeSourceCard({ source, savingKey, onToggle, onRefresh, onRemove }: KnowledgeSourceCardProps) {
  const title = source.title || source.label || "Wissenseintrag";
  const meta = [
    formatKnowledgeSourceType(source.type),
    source.url || source.sourceUrl || "Eigener Inhalt",
    "Produktpfad gespeichert",
  ].filter(Boolean);
  const statusText = formatKnowledgeSourceStatus(source.status || "pending", source.isActive);

  return (
    <div className="knowledge-step__source-card">
      <div className="knowledge-step__source-main">
        <div>
          <strong>{title}</strong>
          <p className="knowledge-step__source-meta">{meta.join(" · ")}</p>
          <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
            {formatKnowledgeSourceUpdatedAt(source.lastSyncedAt || source.createdAt)}
          </p>
        </div>
        <CustomerStatusBadge status={sourceTone(source)} label={statusText} />
      </div>

      <div className="knowledge-step__source-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onToggle(source)}
          disabled={savingKey === `source-${source.id}`}
        >
          {source.isActive ? "Deaktivieren" : "Aktivieren"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRefresh(source)}
          disabled={savingKey === `resync-${source.id}`}
        >
          Neu aktualisieren
        </Button>
        <Button type="button" variant="danger" onClick={() => onRemove(source)} disabled={savingKey === `delete-${source.id}`}>
          Entfernen
        </Button>
      </div>

      {source.errorMessage ? <p className="dashboard-status dashboard-status--error">{source.errorMessage}</p> : null}
    </div>
  );
}
