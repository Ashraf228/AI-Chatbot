import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { WidgetConfigForm } from "../../../../components/widget/WidgetConfigForm";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteWidgetPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Verhalten · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <WidgetConfigForm siteId={siteId} />
      </div>
    </div>
  );
}
