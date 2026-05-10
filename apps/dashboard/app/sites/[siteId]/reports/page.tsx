import { ReportSubscriptionForm } from "../../../../components/reports/ReportSubscriptionForm";
import { SiteBusinessOverview } from "../../../../components/dashboard/SiteBusinessOverview";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteReportsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Berichte · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <div className="dashboard-mb-16">
          <SiteBusinessOverview siteId={siteId} />
        </div>
        <ReportSubscriptionForm siteId={siteId} />
      </div>
    </div>
  );
}
