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
  if (role === "customer" || role === "operator") {
    return DASHBOARD_NAV_ITEMS.filter((item) => item.href !== "/settings");
  }

  return DASHBOARD_NAV_ITEMS;
}

export const dashboardNav = DASHBOARD_NAV_ITEMS;

export const siteTabs = [
  { slug: "", label: "Übersicht" },
  { slug: "setup", label: "Setup" },
  { slug: "knowledge", label: "Wissen" },
  { slug: "widget", label: "Verhalten" },
  { slug: "branding", label: "Design" },
  { slug: "embedding", label: "Einbindung" },
  { slug: "leads", label: "Anfragen" },
  { slug: "conversations", label: "Chats" },
  { slug: "reports", label: "Berichte" },
  { slug: "usage", label: "Nutzung" },
];
