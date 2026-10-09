import { BrandLogo } from "./BrandLogo";
import { getDashboardNavGroups } from "../../lib/dashboard-config";
import { Button } from "../shared/Button";
import { getDashboardSession } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";

export async function Sidebar() {
  const session = await getDashboardSession();
  const navigation = getDashboardNavGroups(session?.role ?? "admin");

  if (!session) {
    return null;
  }

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar__brand">
        <BrandLogo size={56} />
      </div>

      <SidebarNav groups={navigation} />

      <form action="/api/auth/logout" method="POST" className="dashboard-sidebar__logout">
        <Button type="submit" variant="ghost" fullWidth className="dashboard-nav-link">
          Abmelden
        </Button>
      </form>
    </aside>
  );
}
