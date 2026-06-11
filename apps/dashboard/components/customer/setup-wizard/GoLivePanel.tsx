import { Button } from "../../shared/Button";
import { EmptyStateCard } from "../../shared/EmptyStateCard";

type GoLivePanelProps = {
  canGoLive: boolean;
  isLive: boolean;
  isLoading: boolean;
  onGoLive: () => void;
};

export function GoLivePanel({ canGoLive, isLive, isLoading, onGoLive }: GoLivePanelProps) {
  return (
    <div className="dashboard-card dashboard-card--soft launch-step__go-live dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Chatfenster live schalten</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Schalte das Chatfenster erst live, wenn Test und Startklar-Check passen.
        </p>
      </div>

      {isLive ? (
        <p className="dashboard-status dashboard-status--success dashboard-no-margin-bottom">Das Chatfenster ist live.</p>
      ) : (
        <EmptyStateCard
          title="Chatfenster noch nicht live"
          description="Sobald alle wichtigen Punkte erledigt sind, kannst du das Chatfenster live schalten."
        />
      )}

      {!canGoLive && !isLive ? (
        <p className="dashboard-status dashboard-status--warning dashboard-no-margin-bottom">
          Noch nicht startklar. Prüfe zuerst die offenen Punkte im Startklar-Check.
        </p>
      ) : null}

      <Button type="button" onClick={onGoLive} disabled={!canGoLive || isLive || isLoading}>
        {isLoading ? "Schaltet live..." : isLive ? "Live" : "Live schalten"}
      </Button>
    </div>
  );
}
