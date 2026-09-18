import { NextResponse } from "next/server";
import {
  getDashboardSessionCredential,
  type DashboardSessionCredential,
} from "./auth";

type ProxyDependencies = {
  getSessionCredential: () => Promise<DashboardSessionCredential | null>;
  getDashboardOrigin: () => string | undefined;
};

function trustedOrigin(value: string | undefined): string | null {
  if (!value || value !== value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function noStoreError(status: 401 | 403 | 500) {
  const messages = {
    401: "Anmeldung erforderlich.",
    403: "Für diesen Workspace fehlt die Berechtigung.",
    500: "Workspace-Berechtigung konnte nicht geprüft werden.",
  };
  const response = NextResponse.json({ message: messages[status] }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function productionDependencies(): ProxyDependencies {
  return {
    getSessionCredential: getDashboardSessionCredential,
    getDashboardOrigin: () => process.env.DASHBOARD_PUBLIC_URL,
  };
}

export function createCustomerWorkspaceProxyAuthorizer(
  dependencies: Partial<ProxyDependencies> = {},
) {
  const deps = { ...productionDependencies(), ...dependencies };

  return async function authorizeCustomerWorkspaceProxy(
    request: Request,
    options: { mutating: boolean },
  ): Promise<
    | { credential: DashboardSessionCredential; response: null }
    | { credential: null; response: NextResponse }
  > {
    const credential = await deps.getSessionCredential();
    if (!credential) return { credential: null, response: noStoreError(401) };

    const { session } = credential;
    if (!["admin", "operator", "customer"].includes(session.role)) {
      return { credential: null, response: noStoreError(403) };
    }
    if (session.role === "customer" && (!session.tenantId || !session.tenantUserId)) {
      return { credential: null, response: noStoreError(403) };
    }

    if (session.role === "customer" && options.mutating) {
      const expectedOrigin = trustedOrigin(deps.getDashboardOrigin());
      const requestOrigin = trustedOrigin(request.headers.get("origin") || undefined);
      const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
      if (!expectedOrigin) return { credential: null, response: noStoreError(500) };
      if (!requestOrigin || requestOrigin !== expectedOrigin || fetchSite !== "same-origin") {
        return { credential: null, response: noStoreError(403) };
      }
    }

    return { credential, response: null };
  };
}

export function customerWorkspaceAuthorizationHeaders(
  credential: DashboardSessionCredential,
): Record<string, string> {
  return credential.session.role === "customer"
    ? { Authorization: `Bearer ${credential.token}` }
    : {};
}

export const authorizeCustomerWorkspaceProxy = createCustomerWorkspaceProxyAuthorizer();
