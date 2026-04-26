import { useEffect, useState } from "react";
import { ChatLauncher } from "../components/launcher/ChatLauncher";
import { ChatWindow } from "../components/window/ChatWindow";
import { useAnalytics } from "../hooks/useAnalytics";
import { useChat } from "../hooks/useChat";
import { useWidgetConfig } from "../hooks/useWidgetConfig";
import { useSessionContext } from "./providers/SessionProvider";

export function WidgetShell() {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const { consentAccepted, acceptConsent } = useSessionContext();
  const { messages, isSending, error, sendMessage } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
    await track("widget_opened");
  }

  async function closeWidget() {
    setIsOpen(false);
    await track("widget_closed");
  }

  async function handleAcceptConsent() {
    acceptConsent();
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
          suggestedQuestions={suggestedQuestions}
          placeholder={config.placeholder}
          messages={messages}
          isSending={isSending}
          error={error}
          consentRequired={config.consentRequired}
          consentAccepted={consentAccepted}
          onAcceptConsent={handleAcceptConsent}
          onSendMessage={sendMessage}
          onClose={closeWidget}
        />
      ) : null}
      {!isOpen ? (
        <ChatLauncher
          label={config.buttonText}
          unreadCount={unreadCount}
          onClick={openWidget}
        />
      ) : null}
    </div>
  );
}
