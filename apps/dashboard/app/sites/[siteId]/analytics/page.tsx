import { AnalyticsOverview } from "../../../../components/analytics/AnalyticsOverview";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteAnalyticsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Analytics · ${siteId}`} />
      <div style={{ padding: 24, display: "grid", gap: 16 }}>
        <SiteTabs siteId={siteId} />
        <AnalyticsOverview siteId={siteId} />
      </div>
    </div>
  );
}
