import { BrandLogo } from "./BrandLogo";
import Link from "next/link";
import { dashboardNav } from "../../lib/dashboard-config";
import { Button } from "../shared/Button";

export function Sidebar() {
  return (
    <aside className="dashboard-sidebar">
      <BrandLogo size={56} />

      <nav className="dashboard-sidebar-nav">
        {dashboardNav.map((item) => (
          <Link key={item.href} href={item.href} className="dashboard-nav-link">
            {item.label}
          </Link>
        ))}
      </nav>

      <form action="/api/auth/logout" method="POST" style={{ marginTop: "auto" }}>
        <Button type="submit" variant="ghost" fullWidth className="dashboard-nav-link">
          Abmelden
        </Button>
      </form>
    </aside>
  );
}
