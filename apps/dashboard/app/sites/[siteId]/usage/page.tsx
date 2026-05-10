import { SiteUsagePanel } from "../../../../components/billing/SiteUsagePanel";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteUsagePage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Nutzung · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <SiteUsagePanel siteId={siteId} />
      </div>
    </div>
  );
}
