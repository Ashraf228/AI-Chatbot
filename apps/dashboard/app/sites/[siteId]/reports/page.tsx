import { ReportSubscriptionForm } from "../../../../components/reports/ReportSubscriptionForm";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteReportsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

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
