import type { ChatMessage } from "../../types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  showLeadLink?: boolean;
  onLeadLinkClick?: () => void | Promise<void>;
};

export function MessageBubble({
  message,
  showLeadLink = false,
  onLeadLinkClick,
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  if (message.pending && !message.content.trim()) {
    return null;
  }

  return (
    <div className={`ssb-message ssb-message--${message.role}`}>
      <div className="ssb-message-bubble">{message.content}</div>
      {isAssistant && showLeadLink ? (
        <div className="ssb-message-cta">
          <button
            type="button"
            className="ssb-lead-prompt__link"
            onClick={() => void onLeadLinkClick?.()}
          >
            Kontaktdaten hier hinterlassen
          </button>
        </div>
      ) : null}
    </div>
  );
}
