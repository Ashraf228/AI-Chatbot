import { useEffect, useRef, useState } from "react";
import { ChatLauncher } from "../components/launcher/ChatLauncher";
import { ChatWindow } from "../components/window/ChatWindow";
import { useAnalytics } from "../hooks/useAnalytics";
import { useChat } from "../hooks/useChat";
import { useWidgetConfig } from "../hooks/useWidgetConfig";
import { useSessionContext } from "./providers/SessionProvider";

export function WidgetShell() {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const { consentAccepted, acceptConsent, sessionStatus, sessionError } = useSessionContext();
  const { messages, isSending, error, sendMessage } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const chatWindowId = "ssb-chat-window";
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  const suggestedQuestions =
    config.suggestedQuestionsByPath?.[path] ||
    config.suggestedQuestionsByPath?.["/"] ||
    [];

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      return;
    }

    if (messages.length > 1) {
      setUnreadCount((count) => count + 1);
    }
  }, [isOpen, messages.length]);

  async function openWidget() {
    setIsOpen(true);
    await track("open");
  }

  async function closeWidget() {
    setIsOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
    await track("close");
  }

  async function handleAcceptConsent() {
    const session = await acceptConsent();
    if (!session) {
      return;
    }
    await track("consent_accepted");
  }

  return (
    <div
      className={`ssb-widget-shell ssb-widget-shell--${config.position} ${
        isOpen ? "is-open" : ""
      }`}
    >
      {isOpen ? (
        <ChatWindow
          title={config.title}
          companyName={config.companyName}
          botName={config.botName}
          logoUrl={config.logoUrl}
          privacyUrl={config.privacyUrl}
          suggestedQuestions={suggestedQuestions}
          placeholder={config.placeholder}
          messages={messages}
          isSending={isSending}
          chatDisabled={sessionStatus === "initializing"}
          error={error || sessionError}
          consentRequired={config.consentRequired}
          consentAccepted={consentAccepted}
          onAcceptConsent={handleAcceptConsent}
          onSendMessage={sendMessage}
          onClose={closeWidget}
          windowId={chatWindowId}
        />
      ) : null}
      {!isOpen ? (
        <ChatLauncher
          ref={launcherRef}
          label={config.buttonText}
          unreadCount={unreadCount}
          expanded={isOpen}
          controlsId={chatWindowId}
          onClick={openWidget}
        />
      ) : null}
    </div>
  );
}
