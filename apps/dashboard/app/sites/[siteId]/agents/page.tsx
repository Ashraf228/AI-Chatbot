import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { SiteAgentsForm } from "../../../../components/agents/SiteAgentsForm";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteAgentsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Automationen · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <SiteAgentsForm siteId={siteId} />
      </div>
    </div>
  );
}
