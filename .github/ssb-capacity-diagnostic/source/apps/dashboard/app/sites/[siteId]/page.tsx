import { CustomerAdvancedPanel } from "../../../components/customer/CustomerAdvancedPanel";
import { SiteTabs } from "../../../components/layout/SiteTabs";
import { Topbar } from "../../../components/layout/Topbar";
import { CustomerCommandCenter } from "../../../components/sites/CustomerCommandCenter";
import { getDashboardSession } from "../../../lib/auth";
import { decodeSiteId } from "../../../lib/site-id";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getDashboardSession();
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title="Kundenübersicht" />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <CustomerCommandCenter siteId={siteId} />

        {session?.role === "admin" || session?.role === "operator" ? (
          <details className="dashboard-card dashboard-card--compact dashboard-stack dashboard-mt-14">
            <summary
              className="dashboard-card-title"
              style={{ cursor: "pointer", listStyle: "none" }}
            >
              Erweiterte Einstellungen
            </summary>
            <CustomerAdvancedPanel siteId={siteId} role={session.role} />
          </details>
        ) : null}
      </div>
    </div>
  );
}
