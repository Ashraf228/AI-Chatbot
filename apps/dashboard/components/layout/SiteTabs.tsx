import Link from "next/link";
import { siteTabs } from "../../lib/dashboard-config";
import { encodeSiteId } from "../../lib/site-id";

export function SiteTabs({ siteId }: { siteId: string }) {
  const siteSlug = encodeSiteId(siteId);

  return (
    <div className="dashboard-tab-row">
      {siteTabs.map((tab) => (
        <Link
          key={tab.slug || "setup"}
          href={tab.slug ? `/sites/${siteSlug}/${tab.slug}` : `/sites/${siteSlug}`}
          className="dashboard-tab-link"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
