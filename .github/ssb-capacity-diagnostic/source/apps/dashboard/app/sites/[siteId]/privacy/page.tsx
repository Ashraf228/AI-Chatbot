import { CustomerAuditLogTable } from "../../../../components/customer/CustomerAuditLogTable";
import { CustomerDataPrivacyActions } from "../../../../components/customer/CustomerDataPrivacyActions";
import { CustomerRetentionSettings } from "../../../../components/customer/CustomerRetentionSettings";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { getDashboardSession } from "../../../../lib/auth";
import { decodeSiteId } from "../../../../lib/site-id";
import { redirect } from "next/navigation";

export default async function SitePrivacyPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getDashboardSession();
  if (session?.role !== "admin" && session?.role !== "operator") {
    redirect("/sites");
  }

  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Datenschutz · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-stack">
          <section className="dashboard-card dashboard-stack">
            <div>
              <p className="dashboard-eyebrow">DSGVO</p>
              <h2 className="dashboard-card-title">Datenschutz pro Kunde</h2>
              <p className="dashboard-copy">
                Export, Loeschung oder Anonymisierung laufen site-bezogen und werden auditierbar protokolliert.
                Diese Funktionen ersetzen keine Rechtsberatung.
              </p>
            </div>
          </section>
          <CustomerRetentionSettings siteId={siteId} />
          <CustomerDataPrivacyActions siteId={siteId} role={session.role} />
          {session.role === "admin" ? <CustomerAuditLogTable siteId={siteId} /> : null}
        </div>
      </div>
    </div>
  );
}
