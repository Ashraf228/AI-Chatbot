import Link from "next/link";
import { getDashboardSession } from "../../lib/auth";
import { siteTabs } from "../../lib/dashboard-config";
import { encodeSiteId } from "../../lib/site-id";

export async function SiteTabs({ siteId }: { siteId: string }) {
  const siteSlug = encodeSiteId(siteId);
  const session = await getDashboardSession();
  const showAdvanced = session?.role === "admin";
  const tabs = showAdvanced
    ? [...siteTabs, { slug: "privacy", label: "Datenschutz" }, { slug: "advanced", label: "Erweiterte Einstellungen" }]
    : siteTabs;

  return (
    <div className="dashboard-tab-row">
      {tabs.map((tab) => (
        <Link
          key={tab.slug || "overview"}
          href={tab.slug ? `/sites/${siteSlug}/${tab.slug}` : `/sites/${siteSlug}`}
          className="dashboard-tab-link"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
