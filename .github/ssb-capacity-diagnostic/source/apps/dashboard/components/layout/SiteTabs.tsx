import { getDashboardSession } from "../../lib/auth";
import { siteNavGroups } from "../../lib/dashboard-config";
import { CustomerNavGroups } from "../customer/CustomerNavGroups";
import { CustomerStatusBar } from "../customer/CustomerStatusBar";

export async function SiteTabs({ siteId }: { siteId: string }) {
  const session = await getDashboardSession();
  const groups = siteNavGroups.filter((group) => {
    if (!group.adminOnly) {
      return true;
    }

    return session?.role === "admin" || (group.operatorVisible && session?.role === "operator");
  });

  return (
    <div className="customer-detail-shell">
      <CustomerStatusBar siteId={siteId} dashboardRole={session?.role || null} groups={groups} />
      <CustomerNavGroups siteId={siteId} groups={groups} />
    </div>
  );
}
