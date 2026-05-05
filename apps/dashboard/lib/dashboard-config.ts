import type { DashboardSessionRole } from "@/lib/auth";

const DASHBOARD_NAV_ITEMS = [
  { href: "/", label: "Heute" },
  { href: "/sites", label: "Kunden" },
  { href: "/leads", label: "Anfragen" },
  { href: "/conversations", label: "Chats" },
  { href: "/reports", label: "Berichte" },
  { href: "/settings", label: "Einstellungen" },
];

export function getDashboardNav(role: DashboardSessionRole = "admin") {
  if (role === "customer") {
    return DASHBOARD_NAV_ITEMS.filter((item) => item.href !== "/settings");
  }

  return DASHBOARD_NAV_ITEMS;
}

export const dashboardNav = DASHBOARD_NAV_ITEMS;

export const siteTabs = [
  { slug: "", label: "Setup" },
  { slug: "knowledge", label: "Wissen" },
  { slug: "branding", label: "Design" },
  { slug: "widget", label: "Verhalten" },
  { slug: "embedding", label: "Einbindung" },
  { slug: "leads", label: "Anfragen" },
  { slug: "conversations", label: "Chats" },
  { slug: "reports", label: "Berichte" },
];
