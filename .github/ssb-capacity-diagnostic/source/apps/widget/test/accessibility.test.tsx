import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { expectNoCriticalOrSeriousAxeViolations } from "../../../test/ui/accessibility";
import { ChatLauncher } from "../src/components/launcher/ChatLauncher";
import { ChatWindow } from "../src/components/window/ChatWindow";
import { LeadCaptureModal } from "../src/components/lead/LeadCaptureModal";
import type { ChatMessage } from "../src/types/chat";

const baseMessages: ChatMessage[] = [
  {
    id: "assistant-1",
    role: "assistant",
    content: "Guten Tag. Wie kann ich Ihnen helfen?",
    createdAt: "2026-06-24T10:00:00.000Z",
  },
];

function renderChatWindow(overrides: Partial<React.ComponentProps<typeof ChatWindow>> = {}) {
  return render(
    <ChatWindow
      title="Service-Chat"
      companyName="Demo Betrieb"
      botName="Service-Assistent"
      logoUrl=""
      privacyUrl="https://example.com/datenschutz"
      suggestedQuestions={["Was kostet das?"]}
      placeholder="Nachricht schreiben..."
      messages={baseMessages}
      isSending={false}
      error={null}
      consentRequired={false}
      consentAccepted={true}
      onAcceptConsent={() => {}}
      onSendMessage={() => {}}
      onClose={() => {}}
      windowId="test-chat-window"
      {...overrides}
    />,
  );
}

describe("Widget accessibility baseline", () => {
  test("launcher is a named button with state and no critical or serious axe violations", async () => {
    const { container } = render(
      <ChatLauncher
        label="Soforthilfe"
        unreadCount={0}
        expanded={false}
        controlsId="test-chat-window"
        onClick={() => {}}
      />,
    );

    const launcher = screen.getByRole("button", { name: "Soforthilfe öffnen" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(launcher).toHaveAttribute("aria-controls", "test-chat-window");
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("chat window is non-modal, has labelled transcript, composer label, and live announcement", async () => {
    const messages: ChatMessage[] = [
      ...baseMessages,
      {
        id: "user-1",
        role: "user",
        content: "Ich brauche Hilfe.",
        createdAt: "2026-06-24T10:01:00.000Z",
      },
      {
        id: "assistant-2",
        role: "assistant",
        content: "Bitte nennen Sie die Dringlichkeit.",
        createdAt: "2026-06-24T10:02:00.000Z",
      },
    ];
    const { container } = renderChatWindow({ messages });

    expect(screen.getByRole("region", { name: /Service-Chat Chatfenster/i })).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("log", { name: "Chatverlauf" })).toHaveAttribute("aria-live", "off");
    expect(screen.getByText("Antwort des Assistenten: Bitte nennen Sie die Dringlichkeit.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nachricht an den Chat")).toBeInTheDocument();
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("chat loading and error states are programmatically announced", async () => {
    const loading = renderChatWindow({ isSending: true });
    expect(loading.container.querySelector("[role='status']")).toHaveTextContent("Der Assistent schreibt...");
    loading.unmount();

    const errored = renderChatWindow({ error: "Die Nachricht konnte nicht gesendet werden." });
    expect(screen.getByRole("alert")).toHaveTextContent("Die Nachricht konnte nicht gesendet werden.");
    await expectNoCriticalOrSeriousAxeViolations(errored.container);
  });

  test("consent state keeps privacy link keyboard reachable and blocks composer until accepted", async () => {
    const { container } = renderChatWindow({ consentRequired: true, consentAccepted: false });

    expect(screen.getByRole("link", { name: "Datenschutzerklärung öffnen" })).toHaveAttribute("href", "https://example.com/datenschutz");
    expect(screen.getByRole("button", { name: "Einverstanden" })).toBeEnabled();
    expect(screen.getByLabelText("Nachricht an den Chat")).toBeDisabled();
    await expectNoCriticalOrSeriousAxeViolations(container);
  });

  test("lead modal traps keyboard focus, closes with Escape, and returns focus", async () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Kontakt öffnen";
    document.body.appendChild(trigger);
    trigger.focus();

    const { container, unmount } = render(
      <LeadCaptureModal
        open
        state="idle"
        privacyUrl="https://example.com/datenschutz"
        onClose={onClose}
        onSubmit={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Schließen" })).toHaveFocus());
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("link", { name: "Datenschutzerklärung öffnen" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Schließen" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    await expectNoCriticalOrSeriousAxeViolations(container);

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  test("lead modal form exposes labels and validation error state", async () => {
    const { container } = render(
      <LeadCaptureModal
        open
        state="error"
        privacyUrl="https://example.com/datenschutz"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Kontakt aufnehmen" });
    expect(within(dialog).getByLabelText("Name")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("E-Mail")).toHaveAttribute("autocomplete", "email");
    expect(within(dialog).getByLabelText("Telefon optional")).toHaveAttribute("autocomplete", "tel");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Die Anfrage konnte nicht gesendet werden");
    await expectNoCriticalOrSeriousAxeViolations(container);
  });
});
