import { type DashboardSession } from "@/lib/auth";

type SiteLike = {
  id: string;
  tenant_id?: string | null;
  tenantId?: string | null;
};

function resolveBackendBaseUrl() {
  const base = process.env.BACKEND_BASE_URL?.trim();
  if (!base) {
    throw new Error("BACKEND_BASE_URL missing in dashboard/.env.local");
  }

  return base;
}

function resolveDashboardToken() {
  const token =
    process.env.DASHBOARD_INTERNAL_TOKEN?.trim() ||
    process.env.ADMIN_KEY?.trim();
  if (!token) {
    throw new Error(
      "DASHBOARD_INTERNAL_TOKEN missing in dashboard/.env.local"
    );
  }

  return token;
}

export function getDashboardBackendHeaders(
  headers?: HeadersInit,
  session?: DashboardSession | null
): Record<string, string> {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("X-DASHBOARD-TOKEN", resolveDashboardToken());
  if (session) {
    nextHeaders.set("X-DASHBOARD-ROLE", session.role);
    nextHeaders.set("X-DASHBOARD-ACTOR", session.sub);
    if (session.tenantId) {
      nextHeaders.set("X-DASHBOARD-TENANT", session.tenantId);
    }
    if (session.tenantUserId) {
      nextHeaders.set("X-DASHBOARD-TENANT-USER", session.tenantUserId);
    }
    if (session.sessionExpiresAt) {
      nextHeaders.set("X-DASHBOARD-SESSION-EXPIRES", session.sessionExpiresAt);
    }
  }
  return Object.fromEntries(nextHeaders.entries());
}

type DashboardBackendRequestInit = RequestInit & {
  session?: DashboardSession | null;
};

export async function fetchDashboardBackend(
  path: string,
  init: DashboardBackendRequestInit = {}
) {
  const base = resolveBackendBaseUrl();
  const { session, ...fetchInit } = init;
  return fetch(`${base}${path}`, {
    ...fetchInit,
    headers: getDashboardBackendHeaders(init.headers, session),
  });
}

export function filterSitesForSession<T extends SiteLike>(
  session: DashboardSession,
  sites: T[]
) {
  if (session.role === "viewer") {
    return [];
  }

  if (session.role !== "customer" || !session.tenantId) {
    return sites;
  }

  return sites.filter((site) => {
    const tenantId =
      typeof site.tenantId === "string" ? site.tenantId : site.tenant_id;
    return tenantId === session.tenantId;
  });
}

export async function listAccessibleSites(session: DashboardSession) {
  const response = await fetchDashboardBackend("/admin/sites", {
    method: "GET",
    cache: "no-store",
    session,
  });

  if (!response.ok) {
    throw new Error("Sites could not be loaded for access check");
  }

  const data = (await response.json().catch(() => [])) as SiteLike[];
  return filterSitesForSession(session, Array.isArray(data) ? data : []);
}

export async function assertSiteAccess(
  session: DashboardSession,
  siteId: string
) {
  if (session.role === "viewer") {
    throw new Error("Forbidden");
  }

  if (session.role !== "customer") {
    return;
  }

  const sites = await listAccessibleSites(session);
  const allowed = sites.some((site) => site.id === siteId);
  if (!allowed) {
    throw new Error("Forbidden");
  }
}

export async function getAccessibleSiteIds(session: DashboardSession) {
  const sites = await listAccessibleSites(session);
  return new Set(sites.map((site) => site.id));
}

export function filterItemsBySiteAccess<T extends Record<string, unknown>>(
  items: T[],
  allowedSiteIds: Set<string>
) {
  return items.filter((item) => {
    const siteId =
      typeof item.siteId === "string"
        ? item.siteId
        : typeof item.site_id === "string"
          ? item.site_id
          : undefined;
    return siteId ? allowedSiteIds.has(siteId) : false;
  });
}
