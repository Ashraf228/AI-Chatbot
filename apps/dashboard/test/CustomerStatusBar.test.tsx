import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { CustomerStatusBar } from "../components/customer/CustomerStatusBar";
import { siteNavGroups } from "../lib/dashboard-config";

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

describe("CustomerStatusBar", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/sites/site-1/setup?step=launch#customer-test-chat");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/widget/sites/site-1")) {
          return new Response(
            JSON.stringify({
              name: "Muster Handwerk",
              siteKey: "muster-handwerk",
              allowedDomains: ["kunde.de"],
              goLiveAt: "",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/api/sites/site-1/status")) {
          return new Response(
            JSON.stringify({
              siteId: "site-1",
              code: "setup_incomplete",
              label: "Setup unvollständig",
              status: "Setup unvollständig",
              severity: "warning",
              progress: 75,
              lifecycleStatus: "ready_for_test",
              isLiveReady: false,
              missingSteps: ["knowledge"],
              nextAction: {
                key: "knowledge",
                label: "Wissen hinzufügen",
              },
              steps: [],
              knowledgeCount: 0,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  });

  test("keeps workspace boundary context visible without rendering live activation CTAs", async () => {
    render(<CustomerStatusBar siteId="site-1" dashboardRole="operator" groups={siteNavGroups} />);

    await screen.findByText("Muster Handwerk");

    expect(screen.getByText("Bereich: Interner Test")).toBeInTheDocument();
    expect(screen.getByText("Rolle: Operator")).toBeInTheDocument();
    expect(screen.getByText("Interner Testpfad verfügbar")).toBeInTheDocument();
    expect(screen.getByText("Production nicht aktiviert")).toBeInTheDocument();
    expect(screen.getByText("Public Widget nicht aktiviert")).toBeInTheDocument();
    expect(screen.getByText("Go-Live nur nach Review")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Wissen hinzufügen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /live/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /live/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Public Widget aktivieren/i)).not.toBeInTheDocument();
  });
});
