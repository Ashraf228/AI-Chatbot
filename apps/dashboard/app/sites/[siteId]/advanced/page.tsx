import {
  CustomerAdvancedPanel,
  type CustomerAdvancedSection,
} from "../../../../components/customer/CustomerAdvancedPanel";
import { SiteTabs } from "../../../../components/layout/SiteTabs";
import { Topbar } from "../../../../components/layout/Topbar";
import { getDashboardSession } from "../../../../lib/auth";
import { decodeSiteId } from "../../../../lib/site-id";
import { redirect } from "next/navigation";

export default async function SiteAdvancedPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await getDashboardSession();
  if (session?.role !== "admin" && session?.role !== "operator") {
    redirect("/sites");
  }
  const { siteId: rawSiteId } = await params;
  const { section: rawSection } = await searchParams;
  const siteId = decodeSiteId(rawSiteId);
  const section = normalizeAdvancedSection(rawSection);
  if (session.role === "operator" && section !== "automations") {
    redirect(`/sites/${rawSiteId}/advanced?section=automations`);
  }

  return (
    <div>
      <Topbar title={`Erweiterte Einstellungen · ${siteId}`} />
      <div className="dashboard-page dashboard-page--lg">
        <SiteTabs siteId={siteId} />
        <CustomerAdvancedPanel
          siteId={siteId}
          role={session?.role || "admin"}
          section={section}
        />
      </div>
    </div>
  );
}

function normalizeAdvancedSection(section?: string): CustomerAdvancedSection {
  if (
    section === "features" ||
    section === "connections" ||
    section === "automations" ||
    section === "privacy"
  ) {
    return section;
  }

  return "overview";
}
