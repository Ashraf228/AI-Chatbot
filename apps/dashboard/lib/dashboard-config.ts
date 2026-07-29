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

export type SiteNavItem = {
  id: string;
  label: string;
  description: string;
  slug?: string;
  href?: string;
  badge?: string;
  matchPaths?: string[];
  stepKeys?: string[];
  hashTargets?: string[];
};

export type SiteNavGroup = {
  id: string;
  slug: string;
  label: string;
  description: string;
  items: SiteNavItem[];
  adminOnly?: boolean;
  operatorVisible?: boolean;
};

type SiteNavContext = {
  relativePath: string;
  stepKey: string | null;
  hash: string;
};

const SETUP_HASH_TO_STEP_KEY: Record<string, string> = {
  "setup-step-basics": "customer",
  "setup-step-industry": "bot",
  "setup-step-delivery": "delivery",
  "setup-step-flow": "flow",
  "setup-step-knowledge": "knowledge",
  "setup-step-design": "design",
  "setup-step-live": "launch",
  "customer-test-chat": "launch",
};

export function resolveSiteNavHref(siteSlug: string, target: { slug?: string; href?: string }) {
  if (target.href) {
    return target.href.replaceAll(":siteSlug", siteSlug);
  }

  return target.slug ? `/sites/${siteSlug}/${target.slug}` : `/sites/${siteSlug}`;
}

function getSiteNavContext(siteSlug: string, pathname: string, search = "", hash = ""): SiteNavContext {
  const prefix = `/sites/${siteSlug}`;
  const relativePath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\/+/, "") || ""
    : pathname.replace(/^\/+/, "");
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const normalizedHash = hash.replace(/^#/, "");
  const stepKey = query.get("step") || SETUP_HASH_TO_STEP_KEY[normalizedHash] || null;

  return {
    relativePath,
    stepKey,
    hash: normalizedHash,
  };
}

function itemMatches(item: SiteNavItem, context: SiteNavContext) {
  if (item.stepKeys?.length) {
    return context.relativePath === "setup" && item.stepKeys.includes(context.stepKey || "");
  }

  if (item.hashTargets?.length) {
    return context.relativePath === "setup" && item.hashTargets.includes(context.hash);
  }

  const matchPaths = item.matchPaths?.length ? item.matchPaths : [item.slug ?? ""];
  return matchPaths.includes(context.relativePath);
}

export function findSiteWorkspaceLocation(
  groups: SiteNavGroup[],
  siteSlug: string,
  pathname: string,
  search = "",
  hash = "",
) {
  const context = getSiteNavContext(siteSlug, pathname, search, hash);
  const activeGroup =
    groups.find((group) => {
      if (group.items.some((item) => itemMatches(item, context))) {
        return true;
      }

      if (group.slug === "setup") {
        return context.relativePath === "setup";
      }

      return context.relativePath === group.slug;
    }) || groups[0];
  const activeItem = activeGroup?.items.find((item) => itemMatches(item, context)) || null;

  return {
    activeGroup,
    activeItem,
    context,
  };
}

export const siteNavGroups: SiteNavGroup[] = [
  {
    id: "overview",
    slug: "",
    label: "Übersicht",
    description: "Aktiver Kunde, Setup-Status und nächste sinnvolle Aktion.",
    items: [
      {
        id: "overview-status",
        slug: "",
        label: "Workspace-Status",
        description: "Status, Grenzen und nächste Schritte für diese Site.",
      },
    ],
  },
  {
    id: "setup",
    slug: "setup",
    label: "Einrichtung",
    description: "Source of truth für Setup, Review, internen Test und Go-Live-Grenzen.",
    items: [
      {
        id: "setup-bot",
        href: "/sites/:siteSlug/setup?step=bot#setup-step-industry",
        label: "KI-Mitarbeiter",
        description: "Rolle, Ziel und Gesprächsstil im Setup pflegen.",
        stepKeys: ["bot"],
      },
      {
        id: "setup-knowledge",
        href: "/sites/:siteSlug/setup?step=knowledge#setup-step-knowledge",
        label: "Wissen",
        description: "Wissensquellen speichern, prüfen und einsatzbereit machen.",
        stepKeys: ["knowledge"],
      },
      {
        id: "setup-test",
        href: "/sites/:siteSlug/setup?step=launch#customer-test-chat",
        label: "Interner Test",
        description: "Testchat bleibt internal/test-only und nicht öffentlich freigegeben.",
        badge: "Intern",
        hashTargets: ["customer-test-chat"],
      },
      {
        id: "setup-launch",
        href: "/sites/:siteSlug/setup?step=launch#setup-step-live",
        label: "Review & Livegang",
        description: "Review-Gate ohne Deploy-, Public-Widget- oder Production-Freigabe.",
        badge: "Review",
        stepKeys: ["launch"],
      },
    ],
  },
  {
    id: "operations",
    slug: "leads",
    label: "Betrieb",
    description: "Inbox, Konversationsfluss und Auswertung ohne neue Aktivierungen.",
    items: [
      {
        id: "operations-inbox",
        slug: "leads",
        label: "Inbox",
        description: "Anfragen und Chats im bestehenden Betriebsfluss prüfen.",
        matchPaths: ["leads", "conversations"],
      },
      {
        id: "operations-analytics",
        slug: "analytics",
        label: "Auswertung",
        description: "Analytics, Berichte und Nutzung im selben Betriebsbereich.",
        matchPaths: ["analytics", "reports", "usage"],
      },
    ],
  },
  {
    id: "settings",
    slug: "advanced",
    label: "Einstellungen",
    description: "Datenschutz, Verbindungen und erweiterte Steuerung für interne Rollen.",
    adminOnly: true,
    operatorVisible: true,
    items: [
      {
        id: "settings-privacy",
        slug: "privacy",
        label: "Datenschutz",
        description: "Privacy, Verbindungen und Modulstatus ohne neue Produktfreigaben.",
        matchPaths: ["privacy", "integrations", "modules"],
      },
      {
        id: "settings-advanced",
        slug: "advanced",
        label: "Erweitert",
        description: "Interne Steuerung für Admin und Operator.",
      },
    ],
  },
];
