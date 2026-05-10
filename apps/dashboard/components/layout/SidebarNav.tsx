"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavItem = {
  href: string;
  label: string;
};

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/inbox") {
    return pathname === "/inbox" || pathname.startsWith("/leads") || pathname.startsWith("/conversations");
  }

  if (href === "/analytics") {
    return (
      pathname === "/analytics" ||
      pathname.startsWith("/reports") ||
      pathname.startsWith("/usage") ||
      pathname.startsWith("/optimization")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="dashboard-sidebar-nav">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`dashboard-nav-link${isActive(pathname, item.href) ? " dashboard-nav-link--active" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
