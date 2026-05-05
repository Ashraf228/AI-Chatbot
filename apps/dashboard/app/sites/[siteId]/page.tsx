import Link from "next/link";
import { CustomerQuickActions } from "../../../components/customer/CustomerQuickActions";
import { CustomerSetupWizard } from "../../../components/customer/CustomerSetupWizard";
import { SiteTabs } from "../../../components/layout/SiteTabs";
import { Topbar } from "../../../components/layout/Topbar";
import { decodeSiteId, encodeSiteId } from "../../../lib/site-id";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);
  const siteSlug = encodeSiteId(siteId);

  return (
    <div>
      <Topbar title={`Kunde · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-grid dashboard-grid--two">
          <section className="dashboard-stack">
            <CustomerSetupWizard siteId={siteId} />
          </section>

          <section className="dashboard-stack">
            <CustomerQuickActions siteId={siteId} />

            <section className="dashboard-card dashboard-stack">
              <div>
                <h2 className="dashboard-card-title">Betrieb & Technik</h2>
                <p className="dashboard-copy">
                  Nach der Einrichtung arbeitest du je nach Aufgabe entweder im laufenden Betrieb oder
                  in den erweiterten technischen Bereichen.
                </p>
              </div>

              <div className="dashboard-card dashboard-card--soft">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Betrieb</h3>
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
                    description="Report-Empfänger, Historie und laufende Auswertungen einsehen."
                  />
                </div>
              </div>

              <div className="dashboard-card dashboard-card--soft">
                <h3 className="dashboard-card-title dashboard-card-title--sm">Technik & Admin</h3>
                <p className="dashboard-copy dashboard-copy--muted">
                  Diese Bereiche werden seltener gebraucht und sind bewusst vom eigentlichen Setup getrennt.
                </p>
                <div className="dashboard-hub-grid">
                  <SiteHubLink
                    href={`/sites/${siteSlug}/modules`}
                    title="Funktionen"
                    description="Aktive Faehigkeiten und Branchenfunktionen fuer diesen Kunden festlegen."
                  />
                  <SiteHubLink
                    href={`/sites/${siteSlug}/agents`}
                    title="Automationen"
                    description="Ablauflogs, Tickets, Webhooks und weitere Automationsschritte prüfen."
                  />
                  <SiteHubLink
                    href={`/sites/${siteSlug}/integrations`}
                    title="Verbindungen"
                    description="Shopify, Webhooks und weitere externe Systeme verwalten."
                  />
                  <SiteHubLink
                    href={`/sites/${siteSlug}/analytics`}
                    title="Verbesserung"
                    description="Top-Fragen, Conversion und Optimierungshinweise für diesen Kunden prüfen."
                  />
                </div>
              </div>
            </section>
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
