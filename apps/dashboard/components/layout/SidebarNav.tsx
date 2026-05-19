"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarNavItem = {
  href: string;
  label: string;
};

type SidebarNavGroup = {
  label: string;
  defaultOpen?: boolean;
  items: SidebarNavItem[];
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

function isGroupActive(pathname: string, group: SidebarNavGroup) {
  return group.items.some((item) => isActive(pathname, item.href));
}

export function SidebarNav({ groups }: { groups: SidebarNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="dashboard-sidebar-nav">
      {groups.map((group) => {
        const active = isGroupActive(pathname, group);

        return (
          <details
            key={group.label}
            className={`dashboard-nav-group${active ? " dashboard-nav-group--active" : ""}`}
            open={group.defaultOpen || active}
          >
            <summary className="dashboard-nav-group__summary">
              <span>{group.label}</span>
              <span aria-hidden="true">v</span>
            </summary>
            <div className="dashboard-nav-group__items">
              {group.items.map((item) => (
                <Link
                  key={`${group.label}-${item.href}-${item.label}`}
                  href={item.href}
                  className={`dashboard-nav-link${isActive(pathname, item.href) ? " dashboard-nav-link--active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
