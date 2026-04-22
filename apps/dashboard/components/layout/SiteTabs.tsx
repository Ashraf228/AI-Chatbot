import Link from "next/link";
import { siteTabs } from "../../lib/dashboard-config";

export function SiteTabs({ siteId }: { siteId: string }) {
  return (
    <div className="dashboard-tab-row">
      {siteTabs.map((tab) => (
        <Link key={tab} href={`/sites/${siteId}/${tab}`} className="dashboard-tab-link">
          {tab}
        </Link>
      ))}
    </div>
  );
}
