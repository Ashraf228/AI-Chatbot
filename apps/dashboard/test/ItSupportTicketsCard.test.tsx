import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ItSupportTicketsCard } from "../components/it-support/ItSupportTicketsCard";

function listResponse(items: Array<Record<string, unknown>> = []) {
  return {
    items,
    total: items.length,
    limit: 10,
    offset: 0,
  };
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "ticket-1",
    subject: "VPN funktioniert nicht",
    status: "new",
    priority: "high",
    issueType: "vpn",
    affectedSystem: "VPN",
    impact: "single_user",
    urgency: "high",
    reporterEmail: "max@example.com",
    reporterName: "Max Mustermann",
    reporterPhone: "+4917600000000",
    device: "Laptop",
    operatingSystem: "Windows",
    forwardingStatus: "queued",
    conversationId: "conv-1",
    createdAt: "2026-06-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("ItSupportTicketsCard", () => {
  test("renders empty state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(listResponse()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<ItSupportTicketsCard siteId="site-1" />);

    expect(await screen.findByText("Noch keine IT-Support-Tickets vorhanden.")).toBeInTheDocument();
  });

  test("renders list with forwarding badge and opens redacted detail", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(listResponse([ticket()])), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...ticket(),
            description: "Passwort [redacted] und VPN geht nicht.",
            reporter: {
              name: "Max Mustermann",
              email: "max@example.com",
              phone: "+4917600000000",
              department: "Sales",
              location: "Berlin",
            },
            technicalContext: {
              device: "Laptop",
              operatingSystem: "Windows",
              errorMessage: "MFA [redacted]",
              alreadyTried: "Neustart",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ItSupportTicketsCard siteId="site-1" />);

    expect(await screen.findByText("VPN funktioniert nicht")).toBeInTheDocument();
    expect(screen.getByText("Zur Weiterleitung eingereiht")).toBeInTheDocument();
    expect(screen.getByText(/VPN ·/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(await screen.findByText("Ticket-Details")).toBeInTheDocument();
    expect(screen.getByText("Passwort [redacted] und VPN geht nicht.")).toBeInTheDocument();
    expect(screen.queryByText(/Test123|123456|secret-value/i)).not.toBeInTheDocument();
  });

  test("calls API with filter query parameters", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(listResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ItSupportTicketsCard siteId="site-1" />);
    expect(await screen.findByText("Noch keine IT-Support-Tickets vorhanden.")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Suche"), "vpn");
    await user.selectOptions(screen.getByLabelText("Priorität"), "critical");
    await user.type(screen.getByLabelText("Issue Type"), "vpn");
    await user.selectOptions(screen.getByLabelText("Weiterleitung"), "failed");
    await user.type(screen.getByLabelText("Status"), "new");
    await user.click(screen.getByRole("button", { name: "Filter anwenden" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const filteredUrl = String(fetchMock.mock.calls[1]?.[0]);
    expect(filteredUrl).toContain("search=vpn");
    expect(filteredUrl).toContain("priority=critical");
    expect(filteredUrl).toContain("issueType=vpn");
    expect(filteredUrl).toContain("forwardingStatus=failed");
    expect(filteredUrl).toContain("status=new");
  });

  test("renders error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    render(<ItSupportTicketsCard siteId="site-1" />);

    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });
});
