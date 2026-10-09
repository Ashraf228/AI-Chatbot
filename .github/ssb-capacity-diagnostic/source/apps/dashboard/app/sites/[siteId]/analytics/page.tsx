import { AnalyticsOverview } from "../../../../components/analytics/AnalyticsOverview";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteAnalyticsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Verbesserung · ${siteId}`} />
      <div className="dashboard-page dashboard-grid dashboard-gap-16">
        <SiteTabs siteId={siteId} />
        <AnalyticsOverview siteId={siteId} />
      </div>
    </div>
  );
}
