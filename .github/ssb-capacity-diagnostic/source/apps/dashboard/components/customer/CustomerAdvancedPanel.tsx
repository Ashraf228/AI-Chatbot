import Link from "next/link";
import { SiteAgentsForm } from "../agents/SiteAgentsForm";
import { SiteIntegrationsForm } from "../integrations/SiteIntegrationsForm";
import { SiteModulesForm } from "../modules/SiteModulesForm";
import { CustomerAgentActivityTable } from "./CustomerAgentActivityTable";
import { CustomerAuditLogTable } from "./CustomerAuditLogTable";
import { CustomerDangerZone } from "./CustomerDangerZone";
import { CustomerDataPrivacyActions } from "./CustomerDataPrivacyActions";
import { CustomerRetentionSettings } from "./CustomerRetentionSettings";
import type { DashboardSessionRole } from "../../lib/auth";
import { encodeSiteId } from "../../lib/site-id";

export type CustomerAdvancedSection = "overview" | "features" | "connections" | "automations" | "privacy";

type CustomerAdvancedPanelProps = {
  siteId: string;
  role: DashboardSessionRole;
  section?: CustomerAdvancedSection;
};

export function CustomerAdvancedPanel({
  siteId,
  role,
  section = "overview",
}: CustomerAdvancedPanelProps) {
  const siteSlug = encodeSiteId(siteId);
  const activeSection = section === "overview" ? null : section;

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
            {role === "admin" ? (
              <>
                <AdvancedLink
                  href={`/sites/${siteSlug}/advanced?section=features`}
                  title="Funktionen"
                  description="Aktive Fähigkeiten und Branchenmodule festlegen."
                  isActive={activeSection === "features"}
                />
                <AdvancedLink
                  href={`/sites/${siteSlug}/advanced?section=connections`}
                  title="Verbindungen"
                  description="Shopify, Webhooks und weitere externe Systeme verwalten."
                  isActive={activeSection === "connections"}
                />
              </>
            ) : null}
            <AdvancedLink
              href={`/sites/${siteSlug}/advanced?section=automations`}
              title="Automationen"
              description="Abläufe, Tickets, Webhooks und Automationsschritte einsehen."
              isActive={activeSection === "automations"}
            />
            {role === "admin" ? (
              <AdvancedLink
                href={`/sites/${siteSlug}/advanced?section=privacy`}
                title="Datenschutz & Löschen"
                description="Datenaufbewahrung, Datenlöschung und Kundenentfernung verwalten."
                isActive={activeSection === "privacy"}
              />
            ) : null}
          </div>
        </div>

        {role === "admin" ? (
          <div className="dashboard-card dashboard-card--soft">
            <h3 className="dashboard-card-title dashboard-card-title--sm">Admin & Debug</h3>
            <div className="dashboard-hub-grid">
              <AdvancedLink
                href={`/sites/${siteSlug}/advanced?section=automations`}
                title="Automationsprotokoll"
                description="Agent Runs, Tool Calls, Tickets und Webhook-Status prüfen."
                isActive={activeSection === "automations"}
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

        {section !== "overview" ? (
          <section className="dashboard-card dashboard-stack">
            <div className="dashboard-section-heading">
              <div>
                <p className="dashboard-eyebrow">Erweiterte Einstellungen</p>
                <h2 className="dashboard-card-title">{getSectionTitle(section)}</h2>
              </div>
              <Link
                href={`/sites/${siteSlug}/advanced`}
                className="dashboard-button dashboard-button--secondary"
              >
                Zur Übersicht
              </Link>
            </div>
            {section === "features" && role === "admin" ? <SiteModulesForm siteId={siteId} /> : null}
            {section === "connections" && role === "admin" ? <SiteIntegrationsForm siteId={siteId} /> : null}
            {section === "automations" ? (
              <>
                <CustomerAgentActivityTable siteId={siteId} />
                {role === "admin" ? <SiteAgentsForm siteId={siteId} /> : null}
              </>
            ) : null}
            {section === "privacy" && role === "admin" ? (
              <>
                <CustomerDataPrivacyActions siteId={siteId} role={role} />
                <CustomerDangerZone siteId={siteId} />
                <CustomerRetentionSettings siteId={siteId} />
                {role === "admin" ? <CustomerAuditLogTable siteId={siteId} /> : null}
              </>
            ) : null}
          </section>
        ) : null}
      </section>
    </div>
  );
}

function AdvancedLink({
  href,
  title,
  description,
  isActive,
}: {
  href: string;
  title: string;
  description: string;
  isActive?: boolean;
}) {
  return (
    <Link
      href={href}
      className={isActive ? "dashboard-hub-link dashboard-hub-link--active" : "dashboard-hub-link"}
    >
      <strong>{title}</strong>
      <span>{description}</span>
    </Link>
  );
}

function getSectionTitle(section: CustomerAdvancedSection) {
  switch (section) {
    case "features":
      return "Funktionen";
    case "connections":
      return "Verbindungen";
    case "automations":
      return "Automationen";
    case "privacy":
      return "Datenschutz & Löschen";
    default:
      return "Übersicht";
  }
}
