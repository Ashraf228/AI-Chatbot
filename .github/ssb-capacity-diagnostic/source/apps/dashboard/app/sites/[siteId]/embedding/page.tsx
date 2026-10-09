import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { SiteEmbeddingPanel } from "../../../../components/sites/SiteEmbeddingPanel";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteEmbeddingPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Einbindung · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <SiteEmbeddingPanel siteId={siteId} />
      </div>
    </div>
  );
}
