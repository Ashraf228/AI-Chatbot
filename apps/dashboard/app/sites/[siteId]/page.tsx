import Link from "next/link";
import { SiteTabs } from "../../../components/layout/SiteTabs";
import { Topbar } from "../../../components/layout/Topbar";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Site ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-grid dashboard-grid--two">
          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Site-Setup</h2>
              <p className="dashboard-copy">
                Von hier aus erreichst du Branding, Widget-Konfiguration, Knowledge-Basis,
                Konversationen, Analytics und Reports für diese Site.
              </p>
            </div>

            <div className="dashboard-hub-grid">
              <SiteHubLink
                href={`/sites/${siteId}/branding`}
                title="Branding"
                description="Logo, Farben, Bot-Name und Begrüßung anpassen."
              />
              <SiteHubLink
                href={`/sites/${siteId}/widget`}
                title="Widget"
                description="Consent, Lead-Capture und Fragen pro Unterseite steuern."
              />
              <SiteHubLink
                href={`/sites/${siteId}/knowledge`}
                title="Knowledge"
                description="FAQ, PDFs und Trainingsdaten für die RAG-Basis pflegen."
              />
              <SiteHubLink
                href={`/sites/${siteId}/reports`}
                title="Reports"
                description="Empfänger, Versandfrequenz und Report-Historie prüfen."
              />
            </div>
          </section>

          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Empfohlener Ablauf</h2>
              <ol className="dashboard-list">
                <li>Branding und Bot-Auftritt prüfen</li>
                <li>Widget-Verhalten und Consent konfigurieren</li>
                <li>Knowledge-Basis mit FAQ und PDFs befüllen</li>
                <li>Snippet einbauen und Live-Widget testen</li>
                <li>Analytics und Reports nach dem ersten Einsatz kontrollieren</li>
              </ol>
            </div>

            <div className="dashboard-card dashboard-card--soft">
              <h3 className="dashboard-card-title dashboard-card-title--sm">Kurzinfo</h3>
              <div className="dashboard-info-row">
                <strong>Site-ID</strong>
                <span className="dashboard-mono">{siteId}</span>
              </div>
              <p className="dashboard-copy dashboard-copy--muted dashboard-mt-14">
                Nutze die Tabs oder die Schnelllinks oben, um die Site strukturiert aufzusetzen.
              </p>
            </div>
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
