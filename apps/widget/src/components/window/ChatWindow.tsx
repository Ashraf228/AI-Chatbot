import { useLeadCapture } from "../../hooks/useLeadCapture";
import type { ChatMessage } from "../../types/chat";
import { LeadCaptureModal } from "../lead/LeadCaptureModal";
import { LeadCapturePrompt } from "../lead/LeadCapturePrompt";
import { LeadSuccessState } from "../lead/LeadSuccessState";
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
  suggestedQuestions: string[];
  placeholder: string;
  messages: ChatMessage[];
  isSending: boolean;
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
  suggestedQuestions,
  placeholder,
  messages,
  isSending,
  error,
  consentRequired,
  consentAccepted,
  onAcceptConsent,
  onSendMessage,
  onClose,
}: ChatWindowProps) {
  const {
    leadState,
    shouldOfferLeadCapture,
    isModalOpen,
    openLeadCapture,
    closeLeadCapture,
    saveLead,
  } = useLeadCapture(messages.length);

  return (
    <>
      <div className="ssb-chat-window">
        <ChatHeader
          title={title}
          companyName={companyName}
          botName={botName}
          logoUrl={logoUrl}
          onClose={onClose}
        />
        <div className="ssb-chat-body">
          <ConsentBanner
            visible={consentRequired && !consentAccepted}
            onAccept={onAcceptConsent}
          />
          <SuggestedQuestions
            questions={suggestedQuestions}
            disabled={isSending || (consentRequired && !consentAccepted)}
            onSelect={onSendMessage}
          />
          <StatusBanner error={error} isSending={isSending} />
          <MessageList messages={messages} />
          <TypingIndicator visible={isSending} />
          {shouldOfferLeadCapture ? (
            leadState === "success" ? (
              <LeadSuccessState />
            ) : (
              <LeadCapturePrompt onOpen={openLeadCapture} />
            )
          ) : null}
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
