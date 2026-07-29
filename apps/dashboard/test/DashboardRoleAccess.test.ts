import { describe, expect, test } from "vitest";

import { getDashboardRoleAccess } from "../lib/dashboard-role-access";

describe("getDashboardRoleAccess", () => {
  test("maps admin and operator to internal setup/test access without deploy approval", () => {
    for (const role of ["admin", "operator"] as const) {
      const access = getDashboardRoleAccess(role);

      expect(access.isInternalRole).toBe(true);
      expect(access.summary).toBe("Interner Setup- und Testzugang");
      expect(access.capabilities.find((entry) => entry.key === "configure")?.allowed).toBe(true);
      expect(access.capabilities.find((entry) => entry.key === "internal_test")?.allowed).toBe(true);
      expect(access.capabilities.find((entry) => entry.key === "deploy")?.allowed).toBe(false);
      expect(access.capabilities.find((entry) => entry.key === "customer_data")?.allowed).toBe(false);
    }
  });

  test("maps viewer to read-only evaluation without configuration rights", () => {
    const access = getDashboardRoleAccess("viewer");

    expect(access.roleLabel).toBe("Viewer");
    expect(access.isEvaluationOnly).toBe(true);
    expect(access.capabilities.find((entry) => entry.key === "configure")?.allowed).toBe(false);
    expect(access.capabilities.find((entry) => entry.key === "internal_test")?.allowed).toBe(false);
    expect(access.capabilities.find((entry) => entry.key === "review")?.allowed).toBe(false);
    expect(access.demoBoundaryCopy).toMatch(/guided\/evaluation only/i);
  });

  test("keeps unknown access conservative when no trusted role is available", () => {
    const access = getDashboardRoleAccess(null);

    expect(access.role).toBe("unknown");
    expect(access.roleLabel).toBe("Nicht eindeutig");
    expect(access.isInternalRole).toBe(false);
    expect(access.capabilities.every((entry) => entry.allowed === false)).toBe(true);
  });
});
