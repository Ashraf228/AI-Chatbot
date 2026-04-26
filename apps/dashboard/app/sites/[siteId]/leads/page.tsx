import { LeadTable } from "../../../../components/leads/LeadTable";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteLeadsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Leads · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <LeadTable siteId={siteId} />
      </div>
    </div>
  );
}
