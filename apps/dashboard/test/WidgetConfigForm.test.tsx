import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { WidgetConfigForm } from "../components/widget/WidgetConfigForm";

describe("WidgetConfigForm", () => {
  test("applies a flow preset and persists it in the widget config payload", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          siteKey: "kunde-1",
          domain: "soulesmartbusiness.com",
          widgetBundleUrl: "https://widget.soulesmartbusiness.com/widget.js",
          systemPrompt: "",
          isActive: true,
          consentRequired: true,
          leadCaptureEnabled: true,
          leadNotificationEmail: "",
          allowedDomains: ["soulesmartbusiness.com"],
          suggestedQuestionsByPath: { "/": ["Was kostet der Service?"] },
          conversationFlow: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<WidgetConfigForm siteId="site-1" />);

    expect(await screen.findByLabelText("Vorlage")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Vorlage"), "support");
    await user.click(screen.getByRole("button", { name: "Vorlage anwenden" }));

    expect(
      screen.getByLabelText("Einstiegsfrage"),
    ).toHaveValue(
      "Geht es bei dir eher um ein akutes Problem, eine Rückfrage zu einem Vorgang oder allgemeine Hilfe?",
    );
    expect(screen.getByText("Live-Vorschau")).toBeInTheDocument();
    expect(screen.getByText("Einstieg / Klärung")).toBeInTheDocument();

    const leadEmailField = screen.getByPlaceholderText("info@unternehmen.de");
    await user.clear(leadEmailField);
    await user.type(leadEmailField, "info@unternehmen.de");
    await user.click(screen.getByRole("button", { name: "Widget-Konfiguration speichern" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/widget/config/site-1",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const patchCall = fetchMock.mock.calls[1];
    const payload = JSON.parse(String(patchCall?.[1]?.body));

    expect(payload.conversationFlow.questions.opening).toBe(
      "Geht es bei dir eher um ein akutes Problem, eine Rückfrage zu einem Vorgang oder allgemeine Hilfe?",
    );
    expect(payload.leadNotificationEmail).toBe("info@unternehmen.de");
    expect(payload.conversationFlow.triggers.qualifiedNeed).toContain("problem");
    expect(payload.conversationFlow.states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "contact-ready",
          requiresAny: expect.arrayContaining(["contactIntent", "affirmedContactCta"]),
        }),
      ]),
    );
  });
});
