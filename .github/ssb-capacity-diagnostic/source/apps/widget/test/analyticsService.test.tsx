import { afterEach, describe, expect, it, vi } from "vitest";
import { trackWidgetEvent } from "../src/services/analyticsService";
import type { WidgetEventName } from "../src/types/analytics";

const canonicalEvents: WidgetEventName[] = [
  "impression",
  "open",
  "close",
  "chat_started",
  "message_sent",
  "message_received",
  "fallback",
  "lead_modal_opened",
  "lead_submitted",
  "consent_accepted",
];

function baseEvent(name: WidgetEventName) {
  return {
    name,
    siteId: "site-1",
    siteKey: "site-key",
    apiBase: "https://api.example.test",
    sessionId: "session-1",
    metadata: {},
    createdAt: "2026-06-19T12:00:00.000Z",
  };
}

describe("trackWidgetEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends every canonical widget analytics event name unchanged", async () => {
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)));
      return { ok: true };
    }));

    for (const eventName of canonicalEvents) {
      await trackWidgetEvent(baseEvent(eventName));
    }

    expect(calls.map((call) => call.eventType)).toEqual(canonicalEvents);
  });

  it("keeps tracking best effort when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("analytics unavailable");
    }));

    await expect(trackWidgetEvent(baseEvent("message_sent"))).resolves.toBeUndefined();
  });

  it("does not write PII or full page URLs to development diagnostics", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    window.history.pushState({}, "", "/path?email=user@example.test&token=secret");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));

    await trackWidgetEvent({
      ...baseEvent("lead_submitted"),
      metadata: { email: "user@example.test" },
    });

    const debugOutput = JSON.stringify(debug.mock.calls);
    expect(debugOutput).not.toContain("user@example.test");
    expect(debugOutput).not.toContain("token=secret");
    expect(debugOutput).not.toContain("https://example.test/path");
  });
});
