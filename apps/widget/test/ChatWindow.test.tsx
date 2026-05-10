import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("../src/hooks/useWidgetConfig", () => ({
  useWidgetConfig: () => ({
    siteKey: "kunde-1",
    apiBase: "https://api.soulesmartbusiness.com",
  }),
}));

vi.mock("../src/hooks/useAnalytics", () => ({
  useAnalytics: () => ({
    track: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../src/app/providers/SessionProvider", () => ({
  useSessionContext: () => ({
    sessionId: "session-1",
  }),
}));

const submitLeadMock = vi.fn().mockResolvedValue({ ok: true });

vi.mock("../src/services/leadService", () => ({
  submitLead: (...args: unknown[]) => submitLeadMock(...args),
}));

import { ChatWindow } from "../src/components/window/ChatWindow";

describe("ChatWindow", () => {
  test("opens the contact modal from an assistant CTA and submits lead data", async () => {
    const onLeadSubmitted = vi.fn();

    render(
      <ChatWindow
        title="Support"
        companyName="SouleSmartBusiness"
        botName="Service-Assistent"
        logoUrl=""
        suggestedQuestions={[]}
        placeholder="Nachricht schreiben..."
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content:
              "Das sollten wir uns kurz gemeinsam anschauen. Möchtest du lieber direkt eine Anfrage schicken oder einen kurzen Termin ausmachen?",
            createdAt: new Date().toISOString(),
          },
        ]}
        isSending={false}
        error={null}
        consentRequired={false}
        consentAccepted={true}
        onAcceptConsent={() => {}}
        onSendMessage={() => {}}
        onLeadSubmitted={onLeadSubmitted}
        onClose={() => {}}
      />,
    );

    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: "Kontaktdaten hier hinterlassen",
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Kontaktdaten hinterlassen" }),
    ).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Name"), "Max Mustermann");
    await user.type(screen.getByPlaceholderText("E-Mail"), "max@example.com");
    await user.type(
      screen.getByPlaceholderText("Worum geht es? (optional)"),
      "Ich möchte einen Termin.",
    );
    await user.click(screen.getByRole("button", { name: "Anfrage senden" }));

    await waitFor(() =>
      expect(submitLeadMock).toHaveBeenCalledWith(
        expect.objectContaining({
          siteKey: "kunde-1",
          apiBase: "https://api.soulesmartbusiness.com",
        }),
        "session-1",
        expect.objectContaining({
          name: "Max Mustermann",
          email: "max@example.com",
          message: "Ich möchte einen Termin.",
        }),
      ),
    );

    await waitFor(() => expect(onLeadSubmitted).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("dialog", { name: "Kontaktdaten hinterlassen" }),
    ).not.toBeInTheDocument();
  });
});
