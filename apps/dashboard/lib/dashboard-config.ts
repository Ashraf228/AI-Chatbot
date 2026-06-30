import type { DashboardSessionRole } from "@/lib/auth";

const DASHBOARD_NAV_ITEMS = [
  { href: "/", label: "Heute" },
  { href: "/sites", label: "Kunden" },
  { href: "/inbox", label: "Inbox" },
  { href: "/analytics", label: "Auswertung" },
  { href: "/settings", label: "Einstellungen" },
];

export function getDashboardNav(role: DashboardSessionRole = "admin") {
  if (role === "customer" || role === "operator" || role === "viewer") {
    return DASHBOARD_NAV_ITEMS.filter((item) => item.href !== "/settings");
  }

  return DASHBOARD_NAV_ITEMS;
}

export const dashboardNav = DASHBOARD_NAV_ITEMS;

const DASHBOARD_NAV_GROUPS = [
  {
    label: "Navigation",
    defaultOpen: true,
    items: [
      { href: "/", label: "Heute" },
      { href: "/sites", label: "Kunden" },
      { href: "/inbox", label: "Inbox" },
      { href: "/analytics", label: "Auswertung" },
    ],
  },
  {
    label: "Einstellungen",
    adminOnly: true,
    items: [
      { href: "/settings", label: "Einstellungen" },
    ],
  },
];

export function getDashboardNavGroups(role: DashboardSessionRole = "admin") {
  return DASHBOARD_NAV_GROUPS.filter((group) => !group.adminOnly || role === "admin");
}

export const siteNavGroups = [
  {
    slug: "",
    label: "Übersicht",
    items: [{ slug: "", label: "Status" }],
  },
  {
    slug: "setup",
    label: "Einrichtung",
    items: [
      { slug: "setup", label: "Assistent" },
      { slug: "knowledge", label: "Wissen" },
      { slug: "widget", label: "Verhalten" },
      { slug: "branding", label: "Design" },
      { slug: "agents", label: "Agenten" },
      { slug: "embedding", label: "Einbindung" },
    ],
  },
  {
    slug: "leads",
    label: "Inbox",
    items: [
      { slug: "leads", label: "Anfragen" },
      { slug: "conversations", label: "Chats" },
    ],
  },
  {
    slug: "analytics",
    label: "Auswertung",
    items: [
      { slug: "analytics", label: "Analytics" },
      { slug: "reports", label: "Berichte" },
      { slug: "usage", label: "Nutzung" },
    ],
  },
  {
    slug: "advanced",
    label: "Einstellungen",
    adminOnly: true,
    operatorVisible: true,
    items: [
      { slug: "privacy", label: "Datenschutz" },
      { slug: "integrations", label: "Verbindungen" },
      { slug: "modules", label: "Funktionen" },
      { slug: "advanced", label: "Erweitert" },
    ],
  },
];
