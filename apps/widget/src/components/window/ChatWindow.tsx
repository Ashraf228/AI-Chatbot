import type { ChatMessage } from "../../types/chat";
import { ConsentBanner } from "../consent/ConsentBanner";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { StatusBanner } from "./StatusBanner";
import { SuggestedQuestions } from "./SuggestedQuestions";
import { TypingIndicator } from "./TypingIndicator";

type ChatWindowProps = {
  title: string;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  privacyUrl?: string;
  suggestedQuestions: string[];
  placeholder: string;
  messages: ChatMessage[];
  isSending: boolean;
  chatDisabled?: boolean;
  error?: string | null;
  consentRequired: boolean;
  consentAccepted: boolean;
  onAcceptConsent: () => void;
  onSendMessage: (value: string) => void | Promise<void>;
  onClose: () => void;
};

export function ChatWindow({
  title,
  companyName,
  botName,
  logoUrl,
  privacyUrl,
  suggestedQuestions,
  placeholder,
  messages,
  isSending,
  chatDisabled = false,
  error,
  consentRequired,
  consentAccepted,
  onAcceptConsent,
  onSendMessage,
  onClose,
}: ChatWindowProps) {
  const hasUserMessages = messages.some((message) => message.role === "user");

  return (
    <div className="ssb-chat-window">
      <ChatHeader
        title={title}
        companyName={companyName}
        botName={botName}
        logoUrl={logoUrl}
        privacyUrl={privacyUrl}
        onClose={onClose}
      />
      <div className="ssb-chat-body">
        <ConsentBanner
          visible={consentRequired && !consentAccepted}
          privacyUrl={privacyUrl}
          onAccept={onAcceptConsent}
        />
        {!hasUserMessages ? (
          <div className="ssb-start-panel">
            <SuggestedQuestions
              questions={suggestedQuestions}
              disabled={isSending || chatDisabled || (consentRequired && !consentAccepted)}
              onSelect={onSendMessage}
            />
            <p className="ssb-start-panel__hint">
              Die KI kann Fehler machen. Bei Bedarf wird Ihre Anfrage weitergeleitet. Bitte geben Sie keine Passwörter oder Zahlungsdaten ein.
            </p>
          </div>
        ) : null}
        <StatusBanner error={error} isSending={isSending} />
        <MessageList messages={messages} />
        <TypingIndicator visible={isSending} />
        <Composer
          placeholder={placeholder}
          disabled={isSending || chatDisabled || (consentRequired && !consentAccepted)}
          onSubmit={onSendMessage}
        />
      </div>
    </div>
  );
}
