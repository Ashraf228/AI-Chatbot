import { CustomerSetupWizard } from "../../../../components/customer/CustomerSetupWizard";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { getDashboardSession } from "../../../../lib/auth";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteSetupPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);
  const session = await getDashboardSession();

  return (
    <div>
      <Topbar title={`Setup · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <CustomerSetupWizard siteId={siteId} dashboardRole={session?.role || null} />
      </div>
    </div>
  );
}
