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
  headers?: HeadersInit
): Record<string, string> {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("X-DASHBOARD-TOKEN", resolveDashboardToken());
  return Object.fromEntries(nextHeaders.entries());
}

export async function fetchDashboardBackend(
  path: string,
  init: RequestInit = {}
) {
  const base = resolveBackendBaseUrl();
  return fetch(`${base}${path}`, {
    ...init,
    headers: getDashboardBackendHeaders(init.headers),
  });
}

export function filterSitesForSession<T extends SiteLike>(
  session: DashboardSession,
  sites: T[]
) {
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
