import { BrandingForm } from "../../../../components/branding/BrandingForm";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { decodeSiteId } from "../../../../lib/site-id";

export default async function SiteBrandingPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Design · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <BrandingForm siteId={siteId} />
      </div>
    </div>
  );
}
