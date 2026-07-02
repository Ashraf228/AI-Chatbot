import { afterEach, describe, expect, test } from "vitest";

import { GET } from "../app/healthz/route";

const ENV_KEYS = [
  "APP_COMMIT_SHA",
  "NEXT_PUBLIC_APP_COMMIT_SHA",
  "BUILD_COMMIT",
  "GIT_COMMIT",
  "BUILD_DATE",
] as const;

function clearHealthEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("dashboard health route", () => {
  afterEach(() => {
    clearHealthEnv();
  });

  test("returns ok, service and commit from APP_COMMIT_SHA", async () => {
    clearHealthEnv();
    process.env.APP_COMMIT_SHA = "5c05b167a2bc4a556cea6cdbbac25037166c3333";
    process.env.BUILD_DATE = "2026-07-02T11:29:28Z";

    const response = GET();
    const body = await response.json();

    expect(body).toEqual({
      ok: true,
      service: "dashboard",
      commit: "5c05b167a2bc4a556cea6cdbbac25037166c3333",
      buildTime: "2026-07-02T11:29:28Z",
    });
  });

  test("falls back to unknown without commit env", async () => {
    clearHealthEnv();

    const response = GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.service).toBe("dashboard");
    expect(body.commit).toBe("unknown");
    expect(body.buildTime).toBe("unknown");
  });
});
