import { BrandingForm } from "../../../../components/branding/BrandingForm";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";

export default async function SiteBrandingPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;

  return (
    <div>
      <Topbar title={`Branding · ${siteId}`} />
      <div className="dashboard-page">
        <SiteTabs siteId={siteId} />
        <BrandingForm siteId={siteId} />
      </div>
    </div>
  );
}
