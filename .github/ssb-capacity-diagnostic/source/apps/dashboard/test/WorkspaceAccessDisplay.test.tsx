import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

import { CustomerStatusBar } from "../components/customer/CustomerStatusBar";
import { GoLivePanel } from "../components/customer/setup-wizard/GoLivePanel";
import { SetupWizardSidebar } from "../components/customer/setup-wizard/SetupWizardSidebar";
import type { CustomerApiStatus } from "../components/customer/customer-status";
import { siteNavGroups } from "../lib/dashboard-config";
import { getDashboardRoleAccess } from "../lib/dashboard-role-access";

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const accessPath = "/conversation-engine/demo-workspace/access";
const reply = (status = 200) => new Response("{}", { status });

afterEach(() => vi.unstubAllGlobals());

function mockAccess(check: (url: string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    return url.endsWith(accessPath) ? check(url) : Promise.resolve(reply());
  }));
}

function statusBar(siteId = "site-1", role: "customer" | "viewer" | "admin" | null = "customer") {
  return <CustomerStatusBar siteId={siteId} dashboardRole={role} groups={siteNavGroups} />;
}

describe("site-bound workspace access display", () => {
  test.each(["viewer", null] as const)("a workspace display flag does not elevate %s", (role) => {
    const view = getDashboardRoleAccess(role, true);
    expect(view.capabilities.every((entry) => !entry.allowed)).toBe(true);
  });

  test("shows the confirmed customer workspace scope without general knowledge or deploy rights", async () => {
    mockAccess(async () => reply());
    render(statusBar());

    const rights = within(screen.getByLabelText("Zugriffsübersicht"));
    await rights.findByText("Konfigurieren: Ja");
    expect(rights.getByText("Interner Testchat: Ja")).toBeInTheDocument();
    expect(rights.getByText("Demo-Wissen im Workspace: Ja")).toBeInTheDocument();
    expect(rights.queryByText("Wissen hinzufügen: Ja")).not.toBeInTheDocument();
    expect(rights.getByText("Deploy / Oeffentliches Chatfenster: Nein")).toBeInTheDocument();
    expect(rights.getByText("Kundendaten nutzen: Nein")).toBeInTheDocument();
    expect(screen.getByText("Freigegebener Workspace-Zugang für diese Site")).toBeInTheDocument();
  });

  test.each([401, 403, 404, 500])("does not claim access after HTTP %s", async (status) => {
    mockAccess(async () => reply(status));
    render(statusBar());
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith(accessPath))).toBe(true));
    expect(screen.getByText("Konfigurieren: Nein")).toBeInTheDocument();
    expect(screen.getByText("Interner Testchat: Nein")).toBeInTheDocument();
  });

  test("keeps access unconfirmed on network failure", async () => {
    mockAccess(async () => { throw new Error("synthetic unavailable"); });
    render(statusBar());
    await act(async () => {});
    expect(screen.getByText("Konfigurieren: Nein")).toBeInTheDocument();
  });

  test("clears the old site's display before the new site's decision and ignores a late response", async () => {
    let resolveB!: (response: Response) => void;
    const pendingB = new Promise<Response>((resolve) => { resolveB = resolve; });
    mockAccess(async (url) => url.includes("/site-1/") ? reply() : url.includes("/site-2/") ? pendingB : reply(403));
    const view = render(statusBar());
    await screen.findByText("Konfigurieren: Ja");

    view.rerender(statusBar("site-2"));
    expect(screen.getByText("Konfigurieren: Nein")).toBeInTheDocument();
    view.rerender(statusBar("site-3"));
    await act(async () => { resolveB(reply()); });
    expect(screen.getByText("Konfigurieren: Nein")).toBeInTheDocument();
    expect(screen.getByText("Interner Testchat: Nein")).toBeInTheDocument();
  });

  test("a new mount rechecks a revoked grant", async () => {
    let allowed = true;
    mockAccess(async () => reply(allowed ? 200 : 403));
    const view = render(statusBar());
    await screen.findByText("Konfigurieren: Ja");
    view.unmount();
    allowed = false;
    render(statusBar());
    await act(async () => {});
    expect(screen.getByText("Konfigurieren: Nein")).toBeInTheDocument();
  });

  test.each(["viewer", "admin", null] as const)("%s does not acquire customer permissions from the access endpoint", async (role) => {
    mockAccess(async () => reply());
    render(statusBar("site-1", role));
    await act(async () => {});
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith(accessPath))).toBe(false);
    expect(screen.getByText(`Konfigurieren: ${role === "admin" ? "Ja" : "Nein"}`)).toBeInTheDocument();
    expect(screen.getByText("Deploy / Oeffentliches Chatfenster: Nein")).toBeInTheDocument();
  });
});

describe("stored live status and setup activation boundary", () => {
  const siteReply = (id: string) => new Response(JSON.stringify({
    name: `Synthetic ${id}`, siteKey: `synthetic-key-${id}`, allowedDomains: [], goLiveAt: "2026-09-19T00:00:00Z",
  }));
  const statusReply = (id: string) => new Response(JSON.stringify({
    siteId: id, status: "Live", label: `Stored ${id}`, severity: "success", lifecycleStatus: "live", isLiveReady: true,
  }));

  test.each([403, 500, "network"])("clears old site data and widget key while the next site is pending or fails with %s", async (failure) => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(accessPath)) return reply(403);
      if (url.includes("site-2")) {
        await pending;
        if (failure === "network") throw new Error("synthetic failure");
        return reply(failure);
      }
      return url.includes("/api/widget/") ? siteReply("site-1") : statusReply("site-1");
    }));
    const view = render(statusBar("site-1", "admin"));
    await screen.findByText("Synthetic site-1");
    view.rerender(statusBar("site-2", "admin"));
    expect(screen.queryByText("Synthetic site-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Stored site-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Widget-Code kopieren" }));
    expect(writeText).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(screen.queryByText("Synthetic site-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Stored site-1")).not.toBeInTheDocument();
  });

  test("requires fresh site details when returning to a previously loaded site", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    let aRequests = 0;
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", Object.assign(Object.create(navigator), { clipboard: { writeText } }));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("site-2") || ++aRequests > 2) {
        await pending;
        return reply(403);
      }
      return url.includes("/api/widget/") ? siteReply("site-1") : statusReply("site-1");
    }));
    const view = render(statusBar("site-1", "admin"));
    await screen.findByText("Synthetic site-1");
    view.rerender(statusBar("site-2", "admin"));
    view.rerender(statusBar("site-1", "admin"));
    fireEvent.click(screen.getByRole("button", { name: "Widget-Code kopieren" }));
    expect.soft(screen.queryByText("Synthetic site-1")).not.toBeInTheDocument();
    expect.soft(screen.queryByText("Stored site-1")).not.toBeInTheDocument();
    expect.soft(writeText).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(screen.queryByText("Synthetic site-1")).not.toBeInTheDocument();
  });

  test("ignores late site details and status after a newer site's response", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(accessPath)) return reply(403);
      const id = url.includes("site-1") ? "site-1" : "site-2";
      if (id === "site-1") await pending;
      return url.includes("/api/widget/") ? siteReply(id) : statusReply(id);
    }));
    const view = render(statusBar("site-1", "admin"));
    view.rerender(statusBar("site-2", "admin"));
    await screen.findByText("Synthetic site-2");
    await act(async () => { finish(); });
    expect(screen.getByText("Synthetic site-2")).toBeInTheDocument();
    expect(screen.getByText("Stored site-2")).toBeInTheDocument();
    expect(screen.queryByText("Synthetic site-1")).not.toBeInTheDocument();
  });

  test("the status bar qualifies stored live data rather than claiming verified operation", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/api/widget/") ? siteReply("site-1") : statusReply("site-1")));
    render(statusBar("site-1", "admin"));
    await screen.findByText("Synthetic site-1");
    expect(screen.getByText("Gespeicherter Site-Status: live")).toBeInTheDocument();
    expect(screen.getByText("Betriebsfreigabe hier nicht geprüft")).toBeInTheDocument();
    expect(screen.queryByText("Produktivbetrieb aktiv")).not.toBeInTheDocument();
    expect(screen.queryByText("Oeffentliches Chatfenster aktiv")).not.toBeInTheDocument();
  });

  test("the sidebar describes the stored status without claiming verified production operation", () => {
    const status: CustomerApiStatus = {
      siteId: "site-1", code: "live", label: "Live", status: "Live", severity: "success",
      progress: 100, lifecycleStatus: "live", isLiveReady: true, missingSteps: [], steps: [],
      knowledgeCount: 0, industry: "", setupGoal: "", lastTestedAt: "", goLiveAt: "",
    };
    render(<SetupWizardSidebar siteId="site-1" steps={[]} activeStepIndex={0} status={status} dashboardRole="admin" onStepChange={vi.fn()} />);
    expect(screen.getByText(/Das Chatfenster ist im gespeicherten Site-Status als live markiert/)).toBeInTheDocument();
    expect(screen.queryByText(/Der Produktivbetrieb ist bereits aktiv/)).not.toBeInTheDocument();
  });

  test.each([
    { isLive: false, canGoLive: false },
    { isLive: false, canGoLive: true },
    { isLive: true, canGoLive: false },
    { isLive: true, canGoLive: true },
  ])("shows one consistent state for %j without an activation action", ({ isLive, canGoLive }) => {
    const onGoLive = vi.fn();
    render(<GoLivePanel isLive={isLive} canGoLive={canGoLive} isLoading={false} onGoLive={onGoLive} />);
    const state = (label: string) => (_: string, node: Element | null) => node?.textContent === label;
    expect(screen.getByText(state(`Oeffentliches Chatfenster: ${isLive ? "als live markiert" : "nicht aktiviert"}`))).toBeInTheDocument();
    expect(screen.queryByText(state(`Oeffentliches Chatfenster: ${isLive ? "nicht aktiviert" : "als live markiert"}`))).not.toBeInTheDocument();
    expect(screen.getByText(state("Aktivierung in diesem Schritt: nicht verfügbar"))).toBeInTheDocument();
    expect(screen.queryByText(state("Produktivbetrieb: nicht aktiviert"))).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onGoLive).not.toHaveBeenCalled();
  });
});
