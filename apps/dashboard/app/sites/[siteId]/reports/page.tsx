import { ReportSubscriptionForm } from "../../../../components/reports/ReportSubscriptionForm";
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
      <Topbar title={`Reports · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <ReportSubscriptionForm siteId={siteId} />
      </div>
    </div>
  );
}
