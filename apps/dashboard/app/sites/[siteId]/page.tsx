import Link from "next/link";
import { CustomerAdvancedPanel } from "../../../components/customer/CustomerAdvancedPanel";
import { CustomerLiveStatus } from "../../../components/customer/CustomerLiveStatus";
import { CustomerQuickActions } from "../../../components/customer/CustomerQuickActions";
import { SiteTabs } from "../../../components/layout/SiteTabs";
import { Topbar } from "../../../components/layout/Topbar";
import { getDashboardSession } from "../../../lib/auth";
import { decodeSiteId, encodeSiteId } from "../../../lib/site-id";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getDashboardSession();
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);
  const siteSlug = encodeSiteId(siteId);

  return (
    <div>
      <Topbar title={`Übersicht · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-grid dashboard-grid--two">
          <section className="dashboard-stack">
            <CustomerLiveStatus siteId={siteId} />

            <section className="dashboard-card dashboard-stack">
              <div>
                <h2 className="dashboard-card-title">Einrichtung</h2>
                <p className="dashboard-copy">
                  Führe neue Kunden Schritt für Schritt durch Setup, Wissen, Verhalten, Design und Einbindung.
                </p>
              </div>
              <div className="dashboard-hub-grid">
                <SiteHubLink
                  href={`/sites/${siteSlug}/setup`}
                  title="Setup öffnen"
                  description="Geführten Einrichtungsablauf starten oder fortsetzen."
                />
                <SiteHubLink
                  href={`/sites/${siteSlug}/knowledge`}
                  title="Wissen pflegen"
                  description="FAQs, PDFs und weitere Wissensquellen für diesen Kunden verwalten."
                />
                <SiteHubLink
                  href={`/sites/${siteSlug}/widget`}
                  title="Verhalten festlegen"
                  description="Ziel, Gesprächslogik und Antwortverhalten des Bots anpassen."
                />
                <SiteHubLink
                  href={`/sites/${siteSlug}/branding`}
                  title="Design anpassen"
                  description="Logo, Farben, Begrüßung und sichtbare Texte für das Widget prüfen."
                />
                <SiteHubLink
                  href={`/sites/${siteSlug}/embedding`}
                  title="Einbindung vorbereiten"
                  description="Widget-Code kopieren und erlaubte Domains sauber hinterlegen."
                />
              </div>
            </section>
          </section>

          <section className="dashboard-stack">
            <CustomerQuickActions siteId={siteId} />

            <section className="dashboard-card dashboard-stack">
              <div>
                <h2 className="dashboard-card-title">Betrieb</h2>
                <p className="dashboard-copy">
                  Nach dem Go-live wird dieser Bereich zum täglichen Arbeitsort für Auswertung und Nachverfolgung.
                </p>
              </div>

              <div className="dashboard-card dashboard-card--soft">
                <div className="dashboard-hub-grid">
                  <SiteHubLink
                    href={`/sites/${siteSlug}/leads`}
                    title="Anfragen"
                    description="Neue Kontakte, Status und Nachverfolgung im Blick behalten."
                  />
                  <SiteHubLink
                    href={`/sites/${siteSlug}/conversations`}
                    title="Chats"
                    description="Verläufe prüfen und auffällige Gespräche nachvollziehen."
                  />
                  <SiteHubLink
                    href={`/sites/${siteSlug}/reports`}
                    title="Berichte"
                    description="Empfänger, Historie und laufende Auswertungen für diesen Kunden einsehen."
                  />
                </div>
              </div>
            </section>

            {session?.role === "admin" || session?.role === "operator" ? (
              <details className="dashboard-card dashboard-stack">
                <summary
                  className="dashboard-card-title"
                  style={{ cursor: "pointer", listStyle: "none" }}
                >
                  Erweiterte Einstellungen
                </summary>
                <CustomerAdvancedPanel siteId={siteId} role={session.role} />
              </details>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function SiteHubLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="dashboard-hub-link">
      <strong>{title}</strong>
      <span>{description}</span>
    </Link>
  );
}
