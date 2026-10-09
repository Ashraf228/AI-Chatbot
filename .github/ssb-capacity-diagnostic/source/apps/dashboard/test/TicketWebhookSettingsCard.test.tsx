import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { TicketWebhookSettingsCard } from "../components/integrations/TicketWebhookSettingsCard";

describe("TicketWebhookSettingsCard", () => {
  test("saves config, clears secret input and queues a test webhook", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: false,
            label: "Ticket-Weiterleitung",
            targetUrl: "",
            hasSigningSecret: false,
            lastTestStatus: null,
            lastTestAt: null,
            lastError: null,
            forwardingConfigured: false,
            status: "not_configured",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: true,
            label: "Ticket-Weiterleitung",
            targetUrl: "https://example.com/ticket",
            hasSigningSecret: true,
            lastTestStatus: null,
            lastTestAt: null,
            lastError: null,
            forwardingConfigured: true,
            status: "active",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "queued",
            message: "Test-Webhook wurde eingereiht.",
            config: {
              enabled: true,
              label: "Ticket-Weiterleitung",
              targetUrl: "https://example.com/ticket",
              hasSigningSecret: true,
              lastTestStatus: "queued",
              lastTestAt: "2026-06-10T12:00:00.000Z",
              lastError: "",
              forwardingConfigured: true,
              status: "test_queued",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<TicketWebhookSettingsCard siteId="site-1" />);

    expect(await screen.findByText("Ticket-Weiterleitung")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Status"), "enabled");
    await user.type(screen.getByLabelText("Webhook-URL"), "https://example.com/ticket");
    await user.type(screen.getByPlaceholderText("Neues Secret nur bei Bedarf setzen"), "secret-value");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/sites/site-1/ticket-webhook",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const savePayload = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(savePayload.signingSecret).toBe("secret-value");
    expect(screen.getByPlaceholderText("Neues Secret nur bei Bedarf setzen")).toHaveValue("");
    expect(screen.getByText("Secret vorhanden. Der Wert wird nicht im Klartext angezeigt.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Test-Webhook senden" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/sites/site-1/ticket-webhook/test",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText("Test eingereiht")).toBeInTheDocument();
  });
});
