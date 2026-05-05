import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { SiteModulesForm } from "../../../../components/modules/SiteModulesForm";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteModulesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Module · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <SiteModulesForm siteId={siteId} />
      </div>
    </div>
  );
}
