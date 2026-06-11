import { Button } from "../../shared/Button";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

type EmbedCodePanelProps = {
  embedCode: string;
  allowedDomains: string[];
  copied: boolean;
  onCopy: () => void;
};

export function EmbedCodePanel({ embedCode, allowedDomains, copied, onCopy }: EmbedCodePanelProps) {
  return (
    <div className="setup-module-card launch-step__panel launch-step__embed dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Einbau-Code</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Kopiere diesen Code in deine Website, damit das Chatfenster angezeigt wird.
        </p>
      </div>

      {embedCode ? (
        <>
          <textarea className="dashboard-textarea dashboard-mono launch-step__embed-code" readOnly value={embedCode} rows={5} />
          <div className="dashboard-inline dashboard-wrap">
            <Button type="button" onClick={onCopy}>
              Einbau-Code kopieren
            </Button>
            {copied ? <span className="dashboard-status dashboard-status--success">Kopiert</span> : null}
          </div>
        </>
      ) : (
        <EmptyStateCard
          title="Einbau-Code noch nicht verfügbar"
          description="Schließe die Einrichtung ab, damit der Einbau-Code erzeugt werden kann."
        />
      )}

      <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
        Freigegebene Websites: {allowedDomains.length ? allowedDomains.join(", ") : "Noch nicht gesetzt"}
      </p>
    </div>
  );
}
