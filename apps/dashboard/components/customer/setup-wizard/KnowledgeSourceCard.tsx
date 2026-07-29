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

function normalizedStatus(source: KnowledgeSource) {
  const status = (source.status || "").toLowerCase();
  if (!source.isActive || status === "disabled") {
    return "disabled";
  }
  if (status === "ready" || status === "indexed") {
    return "ready";
  }
  if (status === "pending" || status === "processing") {
    return "processing";
  }
  if (status === "failed" || status === "error") {
    return "failed";
  }
  return "unknown";
}

function isDemoOnlySource(source: KnowledgeSource) {
  const normalizedType = source.type.toLowerCase();
  return normalizedType === "demo" || normalizedType === "test" || normalizedType === "synthetic";
}

function persistenceLabel(source: KnowledgeSource) {
  if (source.type.toLowerCase() === "url_metadata") {
    return "Nur Metadatum. Keine gespeicherte Inhaltsquelle.";
  }
  if (isDemoOnlySource(source)) {
    return "Nur testweise sichtbar. Keine bestaetigte produktive Persistenz in diesem Einrichtungsschritt.";
  }
  return "Persistent im bestehenden Produktpfad gespeichert.";
}

function testUsabilityLabel(source: KnowledgeSource) {
  if (isDemoOnlySource(source)) {
    return "Nur im aktuellen Test-/Demo-Kontext nutzbar. Kein Nachweis fuer Public Widget oder Produktivbetrieb.";
  }
  const status = normalizedStatus(source);
  if (status === "ready") {
    return "Im internen Test nutzbar.";
  }
  if (status === "disabled") {
    return "Derzeit nicht im internen Test nutzbar. Erst nach Aktivierung und erfolgreicher Verarbeitung.";
  }
  if (status === "processing") {
    return "Noch nicht im internen Test nutzbar, weil die Quelle noch verarbeitet wird.";
  }
  if (status === "failed") {
    return "Noch nicht im internen Test nutzbar, weil die Quelle fehlerhaft ist.";
  }
  return "Quellendetails in diesem Status nicht verfuegbar.";
}

function completionLabel(source: KnowledgeSource) {
  if (source.type.toLowerCase() === "url_metadata") {
    return "Zaehlt nicht fuer Einrichtung und Save-and-Continue.";
  }
  if (isDemoOnlySource(source)) {
    return "Zaehlt nicht fuer Einrichtung und Save-and-Continue.";
  }
  return normalizedStatus(source) === "ready"
    ? "Zaehlt fuer Einrichtung und Save-and-Continue."
    : "Zaehlt aktuell nicht fuer Einrichtung und Save-and-Continue.";
}

function sourceBoundaryLabel(source: KnowledgeSource) {
  const normalizedType = source.type.toLowerCase();
  if (normalizedType === "url" || normalizedType === "website") {
    return "Einzelne importierte Webseite. Kein automatisches Website-Crawling.";
  }
  if (normalizedType === "url_metadata") {
    return "Website-/Domain-Angabe allein wird nicht automatisch als Wissensquelle genutzt.";
  }
  return "Kein Public Widget, kein Deploy, keine automatische Aktivierung.";
}

export function KnowledgeSourceCard({ source, savingKey, onToggle, onRefresh, onRemove }: KnowledgeSourceCardProps) {
  const title = source.title || source.label || "Wissenseintrag";
  const meta = [
    formatKnowledgeSourceType(source.type),
    source.url || source.sourceUrl || "Eigener Inhalt",
    "Im bestehenden Wissenspfad gespeichert",
  ].filter(Boolean);
  const statusText = formatKnowledgeSourceStatus(source.status || "pending", source.isActive);

  return (
    <div className="knowledge-step__source-card">
      <div className="knowledge-step__source-main">
        <div className="knowledge-step__source-heading">
          <strong className="knowledge-step__source-title">{title}</strong>
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

      <div className="dashboard-grid dashboard-grid--metrics-2">
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
          <strong>Status</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{statusText}</p>
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
          <strong>Persistenz</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{persistenceLabel(source)}</p>
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
          <strong>Interner Test</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{testUsabilityLabel(source)}</p>
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--xs">
          <strong>Einrichtungsrelevanz</strong>
          <p className="dashboard-copy dashboard-no-margin-bottom">{completionLabel(source)}</p>
        </div>
      </div>

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">{sourceBoundaryLabel(source)}</p>

      {source.errorMessage ? <p className="dashboard-status dashboard-status--error">{source.errorMessage}</p> : null}
    </div>
  );
}
