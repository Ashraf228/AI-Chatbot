import { Button } from "../shared/Button";

type EmbedSnippetCardProps = {
  loaderUrl: string;
  siteKey: string;
  embedCode: string;
  copied: string | null;
  onCopy: (value: string, label: string) => void | Promise<void>;
};

export function EmbedSnippetCard({
  loaderUrl,
  siteKey,
  embedCode,
  copied,
  onCopy,
}: EmbedSnippetCardProps) {
  return (
    <div className="dashboard-card dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Einbindung</h3>
        <p className="dashboard-copy dashboard-copy--muted">
          Das Widget wird per Loader-Script eingebunden. Auf Kundenseiten reicht ein einzelner
          Script-Tag mit dem Kundenschlüssel.
        </p>
      </div>

      <div className="dashboard-info-row">
        <strong>Loader</strong>
        <span className="dashboard-breakword dashboard-mono">{loaderUrl}</span>
      </div>

      <div className="dashboard-info-row">
        <strong>Einbindungsschlüssel</strong>
        <span className="dashboard-breakword dashboard-mono">{siteKey}</span>
      </div>

      <div className="dashboard-inline">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCopy(siteKey, "Einbindungsschlüssel")}
        >
          Einbindungsschlüssel kopieren
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCopy(embedCode, "Einbindungscode")}
        >
          Einbindungscode kopieren
        </Button>
      </div>

      <textarea className="dashboard-textarea dashboard-mono" readOnly value={embedCode} />

      {copied ? <p className="dashboard-status dashboard-status--success">{copied} kopiert.</p> : null}
    </div>
  );
}
