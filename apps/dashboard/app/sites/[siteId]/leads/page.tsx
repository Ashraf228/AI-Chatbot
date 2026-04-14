import { LeadTable } from "../../../../components/leads/LeadTable";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteLeadsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Leads · ${siteId}`} />
      <div style={{ padding: 24 }}>
        <SiteTabs siteId={siteId} />
        <LeadTable siteId={siteId} />
      </div>
    </div>
  );
}
