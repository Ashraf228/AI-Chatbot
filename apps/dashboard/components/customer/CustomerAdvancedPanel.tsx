import Link from "next/link";
import type { DashboardSessionRole } from "../../lib/auth";
import { encodeSiteId } from "../../lib/site-id";

type CustomerAdvancedPanelProps = {
  siteId: string;
  role: DashboardSessionRole;
};

export function CustomerAdvancedPanel({ siteId, role }: CustomerAdvancedPanelProps) {
  const siteSlug = encodeSiteId(siteId);

  return (
    <div className="dashboard-stack">
      <section className="dashboard-card dashboard-stack">
        <div>
          <h2 className="dashboard-card-title">Erweiterte Einstellungen</h2>
          <p className="dashboard-copy">
            Diese Bereiche sind für erfahrene Mitarbeiter oder technische Prüfungen gedacht und
            bewusst vom normalen Setup getrennt.
          </p>
        </div>

        <div className="dashboard-card dashboard-card--soft">
          <h3 className="dashboard-card-title dashboard-card-title--sm">Erweitert</h3>
          <div className="dashboard-hub-grid">
            <AdvancedLink
              href={`/sites/${siteSlug}/modules`}
              title="Funktionen"
              description="Aktive Fähigkeiten und Branchenmodule festlegen."
            />
            <AdvancedLink
              href={`/sites/${siteSlug}/integrations`}
              title="Verbindungen"
              description="Shopify, Webhooks und weitere externe Systeme verwalten."
            />
            <AdvancedLink
              href={`/sites/${siteSlug}/agents`}
              title="Automationen"
              description="Abläufe, Tickets, Webhooks und Automationsschritte einsehen."
            />
          </div>
        </div>

        {role === "admin" ? (
          <div className="dashboard-card dashboard-card--soft">
            <h3 className="dashboard-card-title dashboard-card-title--sm">Admin & Debug</h3>
            <div className="dashboard-hub-grid">
              <AdvancedLink
                href={`/sites/${siteSlug}/agents`}
                title="Automationsprotokoll"
                description="Agent Runs, Tool Calls, Tickets und Webhook-Status prüfen."
              />
              <AdvancedLink
                href={`/sites/${siteSlug}/analytics`}
                title="Verbesserung"
                description="Top-Fragen, Conversion und Nutzungsauswertung vertiefen."
              />
              <div className="dashboard-hub-link" style={{ cursor: "default" }}>
                <strong>Logs & Rohdaten</strong>
                <span>Für diesen Bereich fehlen noch eigene Detailseiten. Bis dahin laufen Prüfungen über Automationen und Verbesserung.</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AdvancedLink({
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
