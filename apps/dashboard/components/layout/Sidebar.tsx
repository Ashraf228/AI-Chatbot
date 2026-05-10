import { BrandLogo } from "./BrandLogo";
import { getDashboardNav } from "../../lib/dashboard-config";
import { Button } from "../shared/Button";
import { getDashboardSession } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";

export async function Sidebar() {
  const session = await getDashboardSession();
  const navigation = getDashboardNav(session?.role ?? "admin");

  if (!session) {
    return null;
  }

  return (
    <aside className="dashboard-sidebar">
      <BrandLogo size={56} />

      <SidebarNav items={navigation} />

      <form action="/api/auth/logout" method="POST" style={{ marginTop: "auto" }}>
        <Button type="submit" variant="ghost" fullWidth className="dashboard-nav-link">
          Abmelden
        </Button>
      </form>
    </aside>
  );
}
