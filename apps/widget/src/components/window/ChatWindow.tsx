import { useLeadCapture } from "../../hooks/useLeadCapture";
import type { ChatMessage } from "../../types/chat";
import { LeadCaptureModal } from "../lead/LeadCaptureModal";
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
  error?: string | null;
  consentRequired: boolean;
  consentAccepted: boolean;
  onAcceptConsent: () => void;
  onSendMessage: (value: string) => void | Promise<void>;
  onLeadSubmitted: () => void | Promise<void>;
  onClose: () => void;
};

function getContactCtaMessageId(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant" || !message.content) {
      continue;
    }

    if (
      /kontakt|anfrage|termin|rueckruf|rückruf|gemeinsam anschauen|durchgehen|melden/i.test(
        message.content,
      )
    ) {
      return message.id;
    }

    return null;
  }

  return null;
}

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
  error,
  consentRequired,
  consentAccepted,
  onAcceptConsent,
  onSendMessage,
  onLeadSubmitted,
  onClose,
}: ChatWindowProps) {
  const {
    leadState,
    isModalOpen,
    openLeadCapture,
    closeLeadCapture,
    saveLead,
  } = useLeadCapture({
    onSuccess: async () => {
      await onLeadSubmitted();
    },
  });
  const contactCtaMessageId =
    leadState === "success" ? null : getContactCtaMessageId(messages);
  const hasUserMessages = messages.some((message) => message.role === "user");

  return (
    <>
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
                disabled={isSending || (consentRequired && !consentAccepted)}
                onSelect={onSendMessage}
              />
              <p className="ssb-start-panel__hint">
                Die KI kann Fehler machen. Bei Bedarf wird deine Anfrage weitergeleitet.
              </p>
            </div>
          ) : null}
          <StatusBanner error={error} isSending={isSending} />
          <MessageList
            messages={messages}
            contactCtaMessageId={contactCtaMessageId}
            onContactCtaClick={openLeadCapture}
          />
          <TypingIndicator visible={isSending} />
          <Composer
            placeholder={placeholder}
            disabled={isSending || (consentRequired && !consentAccepted)}
            onSubmit={onSendMessage}
          />
        </div>
      </div>
      <LeadCaptureModal
        open={isModalOpen}
        state={leadState}
        onClose={closeLeadCapture}
        onSubmit={saveLead}
      />
    </>
  );
}
