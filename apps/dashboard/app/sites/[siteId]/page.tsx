import { SiteTabs } from "../../../components/layout/SiteTabs";
import { Topbar } from "../../../components/layout/Topbar";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Site ${siteId}`} />
      <div style={{ padding: 24 }}>
        <SiteTabs siteId={siteId} />
        Site setup hub placeholder
      </div>
    </div>
  );
}
