import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { SiteIntegrationsForm } from "../../../../components/integrations/SiteIntegrationsForm";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteIntegrationsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Verbindungen · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <SiteIntegrationsForm siteId={siteId} />
      </div>
    </div>
  );
}
