import { CustomerAdvancedPanel } from "../../../../components/customer/CustomerAdvancedPanel";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { getDashboardSession } from "../../../../lib/auth";
import { decodeSiteId } from "../../../../lib/site-id";
import { redirect } from "next/navigation";

export default async function SiteAdvancedPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getDashboardSession();
  if (session?.role === "customer") {
    redirect("/sites");
  }
  const { siteId: rawSiteId } = await params;
  const siteId = decodeSiteId(rawSiteId);

  return (
    <div>
      <Topbar title={`Erweiterte Einstellungen · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <CustomerAdvancedPanel siteId={siteId} role={session?.role || "admin"} />
      </div>
    </div>
  );
}
