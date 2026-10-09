import Link from "next/link";
import { Topbar } from "../../components/layout/Topbar";

export default function SettingsPage() {
  return (
    <div>
      <Topbar title="Einstellungen" />
      <div className="dashboard-page dashboard-page--md">
        <div className="dashboard-grid">
          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Betriebsmodus</h2>
              <p className="dashboard-copy">
                Dieses Dashboard ist als internes Admin-Panel aufgebaut. Zugriff läuft über die
                globale Session-Absicherung und die Login-Policy aus deiner Server-Umgebung.
              </p>
            </div>

            <div className="dashboard-info-row">
              <strong>Auth-Modell</strong>
              <span>Single-Admin-Login mit signierter Session</span>
            </div>
            <div className="dashboard-info-row">
              <strong>Absicherung</strong>
              <span>Middleware-geschützt, Cookie-basiert, Rate-Limit auf Login</span>
            </div>
            <div className="dashboard-info-row">
              <strong>Deployment</strong>
              <span>Monorepo mit API, Dashboard, Widget und Reporter</span>
            </div>
          </section>

          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Vor Livegang prüfen</h2>
              <ul className="dashboard-list">
                <li>Produktive Secrets setzen und alte Schlüssel rotieren</li>
                <li>Domain, HTTPS und Reverse Proxy auf dem Server final verdrahten</li>
                <li>SMTP testen und automatische Berichte einmal manuell auslösen</li>
                <li>Mindestens einen Test-Kunden mit echtem Widget-Snippet durchklicken</li>
              </ul>
            </div>

            <div className="dashboard-inline dashboard-wrap">
              <Link href="/reports" className="dashboard-button dashboard-button--primary">
                Berichte prüfen
              </Link>
              <Link href="/sites" className="dashboard-button dashboard-button--secondary">
                Zu den Kunden
              </Link>
              <Link href="/usage" className="dashboard-button dashboard-button--secondary">
                Kosten & Nutzung
              </Link>
              <Link href="/billing" className="dashboard-button dashboard-button--secondary">
                Plan & Limits
              </Link>
            </div>
          </section>

          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Nächste sinnvolle Ausbaustufen</h2>
              <p className="dashboard-copy dashboard-copy--muted">
                Diese Seite ist bewusst schlank gehalten und dient als interne Betriebsübersicht,
                bis später echte Team- oder System-Settings dazukommen.
              </p>
            </div>

            <div className="dashboard-grid dashboard-grid--two">
              <div className="dashboard-card dashboard-card--soft">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Security</h3>
                <p className="dashboard-copy dashboard-copy--muted">
                  2FA, feinere Audit-Logs und härtere Deployment-Policies.
                </p>
              </div>
              <div className="dashboard-card dashboard-card--soft">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Ops</h3>
                <p className="dashboard-copy dashboard-copy--muted">
                  Backups, Monitoring, Mail-Healthchecks und Report-Scheduling.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
