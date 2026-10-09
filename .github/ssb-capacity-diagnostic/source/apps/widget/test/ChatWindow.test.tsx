import { render, screen } from "@testing-library/react";
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

import { ChatWindow } from "../src/components/window/ChatWindow";

describe("ChatWindow", () => {
  test("does not render the contact details CTA block from contact-oriented assistant text", () => {
    render(
      <ChatWindow
        title="Support"
        companyName="SouleSmartBusiness"
        botName="Service-Assistent"
        logoUrl=""
        privacyUrl="https://example.com/datenschutz"
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
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Kontaktdaten/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: /Kontaktdaten/i }),
    ).not.toBeInTheDocument();
  });

  test("does not render lead_capture rich CTA parts", () => {
    render(
      <ChatWindow
        title="Support"
        companyName="SouleSmartBusiness"
        botName="Service-Assistent"
        logoUrl=""
        privacyUrl="https://example.com/datenschutz"
        suggestedQuestions={[]}
        placeholder="Nachricht schreiben..."
        messages={[
          {
            id: "assistant-1",
            role: "assistant",
            content: "Ich kann die Anfrage aufnehmen.",
            parts: [
              { kind: "text", text: "Ich kann die Anfrage aufnehmen." },
              {
                kind: "cta",
                action: "lead_capture",
                label: "Kontaktdaten hinterlassen",
              },
            ],
            createdAt: new Date().toISOString(),
          },
        ]}
        isSending={false}
        error={null}
        consentRequired={false}
        consentAccepted={true}
        onAcceptConsent={() => {}}
        onSendMessage={() => {}}
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Kontaktdaten/i }),
    ).not.toBeInTheDocument();
  });
});
