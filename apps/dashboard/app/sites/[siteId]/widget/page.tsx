import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { WidgetConfigForm } from "../../../../components/widget/WidgetConfigForm";

export default async function SiteWidgetPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Widget · ${siteId}`} />
      <div style={{ padding: 24 }}>
        <SiteTabs siteId={siteId} />
        <WidgetConfigForm siteId={siteId} />
      </div>
    </div>
  );
}
