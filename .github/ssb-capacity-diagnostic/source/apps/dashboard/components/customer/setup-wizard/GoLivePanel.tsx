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
          Dieser Schritt ist ein Review-Gate. Er aktiviert weder Deploy noch oeffentliches Chatfenster oder
          Produktivbetrieb.
        </p>
      </div>

      {isLive ? (
        <p className="dashboard-status dashboard-status--success dashboard-no-margin-bottom">
          Das Chatfenster ist im gespeicherten Site-Status als live markiert. Dieser Bereich verändert diesen Status nicht.
        </p>
      ) : (
        <EmptyStateCard
          title="Livegang bleibt gesperrt"
          description="Auch bei intern erfolgreichem Review bleiben Livegang, oeffentliches Chatfenster und Deploy bis zu einem separaten Freigabe-Gate blockiert."
        />
      )}

      <div className="dashboard-stack dashboard-stack--xs">
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Deploy:</strong> nicht freigegeben</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Oeffentliches Chatfenster:</strong> {isLive ? "als live markiert" : "nicht aktiviert"}</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Aktivierung in diesem Schritt:</strong> nicht verfügbar</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Kundendaten:</strong> keine Freigabe durch diesen Schritt</p>
        <p className="dashboard-copy dashboard-no-margin-bottom"><strong>Echte Tickets / E-Mails / Webhooks im internen Test:</strong> werden nicht ausgelöst</p>
      </div>

      {!canGoLive && !isLive ? (
        <p className="dashboard-status dashboard-status--warning dashboard-no-margin-bottom">
          Interne Freigabe noch nicht erreicht. Prüfe zuerst die offenen Setup- und Testpunkte im Review-Bereich.
        </p>
      ) : canGoLive && !isLive ? (
        <p className="dashboard-status dashboard-status--warning dashboard-no-margin-bottom">
          Einrichtung intern geprueft. Der Livegang bleibt trotzdem gesperrt, bis ein separates Deploy-/Public-Widget-Gate freigegeben wird.
        </p>
      ) : null}
    </div>
  );
}
