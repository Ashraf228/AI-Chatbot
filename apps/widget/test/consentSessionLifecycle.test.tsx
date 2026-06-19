import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { initSession, ensureSession } from "../src/bootstrap/initSession";
import { WidgetApp } from "../src/app/WidgetApp";
import { AnalyticsProvider, useAnalyticsContext } from "../src/app/providers/AnalyticsProvider";
import { ConfigProvider } from "../src/app/providers/ConfigProvider";
import { SessionProvider, useSessionContext } from "../src/app/providers/SessionProvider";
import { cleanupWidgetIdentifiers, persistConsent } from "../src/services/sessionService";
import { sanitizeBrowserUrl } from "../src/services/urlSanitizer";
import type { WidgetRuntimeConfig } from "../src/types/config";
import type { WidgetSessionBootstrap } from "../src/bootstrap/initSession";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  };
}

function configFor(siteId: string, consentRequired = true): WidgetRuntimeConfig {
  return {
    siteId,
    siteKey: `${siteId}-key`,
    publicKey: "public-key",
    apiBase: "https://api.example.test",
    title: "Widget",
    companyName: "Beispiel GmbH",
    botName: "Assistent",
    logoUrl: "",
    greeting: "Guten Tag, wie kann ich Ihnen behilflich sein?",
    placeholder: "Nachricht schreiben...",
    buttonText: "Chat",
    position: "bottom-right",
    consentRequired,
    leadCaptureEnabled: true,
    theme: {},
    privacyUrl: "https://example.test/datenschutz",
    suggestedQuestionsByPath: { "/": ["Hallo"] },
  };
}

function mockSessionFetch(calls: Array<{ url: string; body: Record<string, unknown> }>, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    if (status >= 400) {
      return { ok: false, status };
    }
    return {
      ok: true,
      json: async () => ({ id: "session-server-1", visitorId: "visitor-server-1" }),
    };
  }));
}

function ConsentHarness({
  config,
  initialSession,
}: {
  config: WidgetRuntimeConfig;
  initialSession: WidgetSessionBootstrap;
}) {
  function Controls() {
    const { acceptConsent, ensureSession: ensureSessionFromContext } = useSessionContext();
    const { track } = useAnalyticsContext();

    async function acceptAndTrack() {
      const session = await acceptConsent();
      if (session) {
        await track("consent_accepted");
      }
    }

    return (
      <>
        <button type="button" onClick={() => void acceptAndTrack()}>
          accept
        </button>
        <button type="button" onClick={() => void ensureSessionFromContext()}>
          ensure
        </button>
      </>
    );
  }

  return (
    <ConfigProvider config={config}>
      <SessionProvider initialSession={initialSession}>
        <AnalyticsProvider>
          <Controls />
        </AnalyticsProvider>
      </SessionProvider>
    </ConfigProvider>
  );
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createMemoryStorage(),
    configurable: true,
  });
  Object.defineProperty(window, "sessionStorage", {
    value: createMemoryStorage(),
    configurable: true,
  });
});

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("consent controlled widget session lifecycle", () => {
  it("does not create identifiers, sessions or analytics before required consent", async () => {
    const config = configFor("pre-consent");
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);

    const session = await initSession(config);
    const ensured = await ensureSession(config);

    expect(session).toEqual({
      sessionId: null,
      visitorId: null,
      consentAccepted: false,
      sessionStatus: "not_started",
    });
    expect(ensured).toBeNull();
    expect(calls).toEqual([]);
    expect(window.localStorage.getItem("ssb_visitor_pre-consent")).toBeNull();
    expect(window.localStorage.getItem("ssb_session_pre-consent")).toBeNull();
    expect(window.sessionStorage.getItem("ssb_visitor_pre-consent")).toBeNull();
    expect(window.sessionStorage.getItem("ssb_session_pre-consent")).toBeNull();
  });

  it("removes old widget identifiers without touching unrelated storage when consent is missing", async () => {
    const config = configFor("cleanup");
    window.localStorage.setItem("ssb_visitor_cleanup", "old-visitor");
    window.localStorage.setItem("ssb_session_cleanup", "old-session");
    window.sessionStorage.setItem("ssb_visitor_cleanup", "old-session-visitor");
    window.localStorage.setItem("other_app_key", "keep");
    document.cookie = "ssb_session_cleanup=old-session; path=/";

    await initSession(config);

    expect(window.localStorage.getItem("ssb_visitor_cleanup")).toBeNull();
    expect(window.localStorage.getItem("ssb_session_cleanup")).toBeNull();
    expect(window.sessionStorage.getItem("ssb_visitor_cleanup")).toBeNull();
    expect(window.localStorage.getItem("other_app_key")).toBe("keep");
    expect(document.cookie).not.toContain("ssb_session_cleanup=");
  });

  it("stores consent first, creates one session and tracks consent_accepted only with a session", async () => {
    const config = configFor("accept-flow");
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);
    const initialSession = await initSession(config);

    render(<ConsentHarness config={config} initialSession={initialSession} />);
    fireEvent.click(screen.getByRole("button", { name: "accept" }));

    await waitFor(() => expect(calls).toHaveLength(2));

    expect(window.localStorage.getItem("ssb_consent_accept-flow")).toBe("accepted");
    expect(calls[0].url).toBe("https://api.example.test/widget/session");
    expect(calls[0].body).toMatchObject({
      siteKey: "accept-flow-key",
      visitorId: expect.any(String),
      sourceUrl: "http://localhost:3000/",
      userAgent: expect.any(String),
    });
    expect(calls[1].url).toBe("https://api.example.test/widget/events");
    expect(calls[1].body).toMatchObject({
      eventType: "consent_accepted",
      sessionId: "session-server-1",
    });
  });

  it("shares parallel ensureSession calls and retries after a failed session request", async () => {
    const config = configFor("parallel-retry");
    persistConsent(config.siteId);
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls, 500);

    await expect(ensureSession(config)).rejects.toThrow("Session init failed");
    expect(calls).toHaveLength(1);

    vi.restoreAllMocks();
    calls.length = 0;
    mockSessionFetch(calls);

    const [first, second] = await Promise.all([
      ensureSession(config),
      ensureSession(config),
    ]);

    expect(calls).toHaveLength(1);
    expect(first).toEqual(second);
    expect(first?.sessionId).toBe("session-server-1");
  });

  it("keeps consentRequired=false usable and initializes one session", async () => {
    const config = configFor("no-consent-needed", false);
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);

    const session = await initSession(config);

    expect(session.sessionStatus).toBe("ready");
    expect(session.consentAccepted).toBe(true);
    expect(calls).toHaveLength(1);
    expect(window.localStorage.getItem("ssb_session_no-consent-needed")).toBe("session-server-1");
  });

  it("reuses a stored valid session after stored consent without another request", async () => {
    const config = configFor("stored-consent");
    persistConsent(config.siteId);
    window.localStorage.setItem("ssb_visitor_stored-consent", "visitor-existing");
    window.localStorage.setItem("ssb_session_stored-consent", "session-existing");
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);

    const session = await initSession(config);

    expect(session).toMatchObject({
      sessionId: "session-existing",
      visitorId: "visitor-existing",
      consentAccepted: true,
      sessionStatus: "ready",
    });
    expect(calls).toEqual([]);
  });

  it("does not send chat messages before required consent", async () => {
    const config = configFor("chat-blocked");
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);
    const initialSession = await initSession(config);

    render(<WidgetApp config={config} initialSession={initialSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Chat öffnen" }));
    const composer = screen.getByPlaceholderText("Nachricht schreiben...");

    expect(composer).toBeDisabled();
    expect(calls).toEqual([]);
  });

  it("sanitizes browser URLs to origin and pathname only", () => {
    expect(sanitizeBrowserUrl("https://user:pass@example.test/path/file?email=a@test.dev#secret")).toBe(
      "https://example.test/path/file",
    );
    expect(sanitizeBrowserUrl("not a url")).toBe("");
  });

  it("does not leak full URLs or e-mail addresses in analytics diagnostics", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    window.history.pushState({}, "", "/path?email=user@example.test&token=secret#fragment");
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    mockSessionFetch(calls);

    const { trackWidgetEvent } = await import("../src/services/analyticsService");
    await trackWidgetEvent({
      name: "lead_submitted",
      siteId: "site",
      siteKey: "site-key",
      apiBase: "https://api.example.test",
      sessionId: "session-1",
      metadata: { hasEmail: true },
      createdAt: "2026-06-19T12:00:00.000Z",
    });

    expect(calls[0].body.pageUrl).toBe("http://localhost:3000/path");
    const debugOutput = JSON.stringify(debug.mock.calls);
    expect(debugOutput).not.toContain("user@example.test");
    expect(debugOutput).not.toContain("token=secret");
    expect(debugOutput).not.toContain("#fragment");
  });
});
