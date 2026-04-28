import { Button } from "../shared/Button";

type EmbedSnippetCardProps = {
  loaderUrl: string;
  siteKey: string;
  internalId: string;
  publicKey: string | null;
  embedCode: string;
  copied: string | null;
  onCopy: (value: string, label: string) => void | Promise<void>;
};

export function EmbedSnippetCard({
  loaderUrl,
  siteKey,
  internalId,
  publicKey,
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
        <strong>Kundenschlüssel</strong>
        <span className="dashboard-breakword dashboard-mono">{siteKey}</span>
      </div>

      <div className="dashboard-info-row">
        <strong>Technische ID</strong>
        <span className="dashboard-breakword dashboard-mono">{internalId}</span>
      </div>

      <div className="dashboard-info-row">
        <strong>Public Key</strong>
        <span className="dashboard-breakword dashboard-mono">
          {publicKey || "nicht vorhanden"}
        </span>
      </div>

      <div className="dashboard-inline">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onCopy(siteKey, "Kundenschlüssel")}
        >
          Kundenschlüssel kopieren
        </Button>
        {publicKey ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onCopy(publicKey, "Public Key")}
          >
            Public Key kopieren
          </Button>
        ) : null}
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
