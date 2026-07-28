import { EmptyStateCard } from "../../shared/EmptyStateCard";

type GoLivePanelProps = {
  canGoLive: boolean;
  isLive: boolean;
  isLoading: boolean;
  onGoLive: () => void;
};

export function GoLivePanel({ canGoLive, isLive, isLoading: _isLoading, onGoLive: _onGoLive }: GoLivePanelProps) {
  return (
    <div className="dashboard-card dashboard-card--soft launch-step__go-live dashboard-stack dashboard-stack--sm">
      <div>
        <h3 className="dashboard-card-title dashboard-card-title--sm">Aktivierungsgrenze</h3>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Dieser P0-Schritt ist ein Review-Gate. Er aktiviert weder Deploy noch Public Widget oder Production.
        </p>
      </div>

      {isLive ? (
        <p className="dashboard-status dashboard-status--success dashboard-no-margin-bottom">
          Das Chatfenster ist bereits live. Dieser Bereich bleibt trotzdem ein reiner Review- und Diagnose-Schritt.
        </p>
      ) : (
        <EmptyStateCard
          title="Livegang bleibt gesperrt"
          description="Auch bei intern erfolgreichem Review bleibt Livegang, Public Widget und Deploy bis zu einem separaten Freigabe-Gate blockiert."
        />
      )}

      <div className="dashboard-stack dashboard-stack--xs">
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Deploy:</strong> nicht freigegeben</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Public Widget:</strong> nicht aktiviert</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Production:</strong> nicht aktiviert</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Kundendaten:</strong> nicht freigegeben</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Echte Tickets / E-Mails / Webhooks:</strong> nein</p>
      </div>

      {!canGoLive && !isLive ? (
        <p className="dashboard-status dashboard-status--warning dashboard-no-margin-bottom">
          Interne Freigabe noch nicht erreicht. Prüfe zuerst die offenen Setup- und Testpunkte im Review-Bereich.
        </p>
      ) : canGoLive && !isLive ? (
        <p className="dashboard-status dashboard-status--warning dashboard-no-margin-bottom">
          Setup intern geprüft. Livegang bleibt trotzdem gesperrt, bis ein separates Deploy-/Public-Widget-Gate freigegeben wird.
        </p>
      ) : null}
    </div>
  );
}
