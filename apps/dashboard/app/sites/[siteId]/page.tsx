import Link from "next/link";
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
          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Setup</h2>
              <p className="dashboard-copy">
                Von hier aus richtest du Design, Verhalten, Wissen, Chats, Verbesserung und
                Berichte für diesen Kunden ein.
              </p>
            </div>

            <div className="dashboard-hub-grid">
              <SiteHubLink
                href={`/sites/${siteSlug}/modules`}
                title="Funktionen"
                description="Aktive Faehigkeiten und Branchenfunktionen fuer diesen Kunden festlegen."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/agents`}
                title="Automationen"
                description="Verfuegbare Automationen, Voraussetzungen und spaetere Ablauflogs pruefen."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/integrations`}
                title="Verbindungen"
                description="Shopify, Webhooks und weitere externe Systeme fuer diesen Kunden verwalten."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/branding`}
                title="Design"
                description="Logo, Farben, Schrift und Begrüßung anpassen."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/widget`}
                title="Verhalten"
                description="Ziel, Kontaktlogik und Chat-Ablauf des Bots steuern."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/knowledge`}
                title="Wissen"
                description="FAQs, PDFs und weitere Inhalte für den Bot pflegen."
              />
              <SiteHubLink
                href={`/sites/${siteSlug}/reports`}
                title="Berichte"
                description="Empfänger, Versand und bisherige Berichte prüfen."
              />
            </div>
          </section>

          <section className="dashboard-card dashboard-stack">
            <div>
              <h2 className="dashboard-card-title">Empfohlener Ablauf</h2>
              <ol className="dashboard-list">
                <li>Design und Auftritt des Bots prüfen</li>
                <li>Verhalten, Kontaktziel und Consent festlegen</li>
                <li>Wissen mit FAQs und PDFs befüllen</li>
                <li>Einbindung auf der Website testen</li>
                <li>Anfragen, Chats und Berichte nach dem Start kontrollieren</li>
              </ol>
            </div>

            <div className="dashboard-card dashboard-card--soft">
              <h3 className="dashboard-card-title dashboard-card-title--sm">Kurzinfo</h3>
              <div className="dashboard-info-row">
                <strong>Kunden-ID</strong>
                <span className="dashboard-mono">{siteId}</span>
              </div>
              <p className="dashboard-copy dashboard-copy--muted dashboard-mt-14">
                Nutze die Tabs oder die Schnelllinks oben, um den Kunden strukturiert einzurichten.
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
