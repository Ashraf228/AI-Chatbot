import { describe, expect, test, vi } from "vitest";

import {
  createTenantSessionToken,
  createViewerSessionToken,
  getSessionCookieOptions,
  verifySessionToken,
} from "../lib/auth-core";
import { toPublicSession } from "../lib/session-public";
import {
  mapTenantUserRoleToDashboardRole,
  resolveTenantLoginSessionInput,
} from "../lib/tenant-user-role";
import { isViewerAllowedPath } from "../lib/viewer-access";

const SESSION_SECRET = "viewer-session-test-secret-1234567890";

describe("viewer dashboard sessions", () => {
  test("maps backend tenant roles without trusting browser supplied roles", () => {
    expect(mapTenantUserRoleToDashboardRole("viewer")).toBe("viewer");
    expect(mapTenantUserRoleToDashboardRole("editor")).toBe("customer");
    expect(mapTenantUserRoleToDashboardRole("owner")).toBe("customer");
    expect(mapTenantUserRoleToDashboardRole("admin")).toBe("customer");
    expect(mapTenantUserRoleToDashboardRole("customer")).toBeNull();
    expect(mapTenantUserRoleToDashboardRole("super-admin")).toBeNull();
  });

  test("resolves tenant login sessions only from authenticated backend payload", () => {
    expect(
      resolveTenantLoginSessionInput({
        id: "tenant-user-1",
        tenantId: "tenant-a",
        email: "viewer@example.test",
        displayName: "Viewer",
        role: "viewer",
      }),
    ).toMatchObject({
      role: "viewer",
      tenantId: "tenant-a",
      tenantUserId: "tenant-user-1",
      email: "viewer@example.test",
    });

    expect(
      resolveTenantLoginSessionInput({
        tenantId: "tenant-a",
        email: "editor@example.test",
        role: "editor",
      }),
    ).toMatchObject({
      role: "customer",
      tenantId: "tenant-a",
      email: "editor@example.test",
    });

    expect(
      resolveTenantLoginSessionInput({
        email: "viewer@example.test",
        role: "viewer",
      }),
    ).toBeNull();
    expect(
      resolveTenantLoginSessionInput({
        tenantId: "tenant-a",
        email: "viewer@example.test",
        role: "admin-from-browser",
      }),
    ).toBeNull();
  });

  test("creates tenant-bound viewer sessions with account-bounded expiry", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SESSION_SECRET);
    const accountExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const token = await createViewerSessionToken({
      tenantId: "tenant-demo",
      tenantUserId: "tenant-user-1",
      email: "viewer@example.test",
      displayName: "Demo Viewer",
      accountExpiresAt,
    });
    const session = await verifySessionToken(token);

    expect(session?.role).toBe("viewer");
    expect(session?.tenantId).toBe("tenant-demo");
    expect(session?.tenantUserId).toBe("tenant-user-1");
    expect(session?.accountExpiresAt).toBe(accountExpiresAt);
    expect(Date.parse(session?.sessionExpiresAt || "")).toBeLessThanOrEqual(
      Date.parse(accountExpiresAt),
    );
  });

  test("rejects tenant roles without tenantId and expired account sessions", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SESSION_SECRET);

    await expect(
      createTenantSessionToken({
        role: "viewer",
        tenantId: "",
        email: "viewer@example.test",
        displayName: "Demo Viewer",
      }),
    ).rejects.toThrow("tenantId");

    const expiredToken = await createViewerSessionToken({
      tenantId: "tenant-demo",
      email: "viewer@example.test",
      displayName: "Demo Viewer",
      accountExpiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
    });

    await expect(verifySessionToken(expiredToken)).resolves.toBeNull();
  });

  test("public session response exposes only safe metadata", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", SESSION_SECRET);
    const token = await createViewerSessionToken({
      tenantId: "tenant-demo",
      email: "viewer@example.test",
      displayName: "Demo Viewer",
    });
    const session = await verifySessionToken(token);

    expect(session).not.toBeNull();
    expect(toPublicSession(session!)).toEqual({
      role: "viewer",
      displayName: "Demo Viewer",
      tenantId: "tenant-demo",
      sessionExpiresAt: session!.sessionExpiresAt,
      accountExpiresAt: null,
    });
    expect(Object.keys(toPublicSession(session!))).not.toContain("email");
    expect(Object.keys(toPublicSession(session!))).not.toContain("sub");
  });

  test("session cookie remains httpOnly and secure in production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      expect(getSessionCookieOptions()).toMatchObject({
        httpOnly: true,
        sameSite: "strict",
        secure: true,
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  test("viewer path allowlist uses exact public session and evaluation paths", () => {
    expect(isViewerAllowedPath("/evaluation")).toBe(true);
    expect(isViewerAllowedPath("/api/auth/session")).toBe(true);
    expect(isViewerAllowedPath("/api/auth/logout")).toBe(true);
    expect(isViewerAllowedPath("/sites")).toBe(false);
    expect(isViewerAllowedPath("/api/sites")).toBe(false);
    expect(isViewerAllowedPath("/api/auth/session/extra")).toBe(false);
  });
});
