import type { ChatMessage } from "../../types/chat";
import { buildMessageParts } from "../../renderers/messageParts";
import { MessageRichContent } from "../rich-content/MessageRichContent";

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
  const parts = buildMessageParts(message);
  const hasLeadCtaPart = parts.some(
    (part) => part.kind === "cta" && part.action === "lead_capture",
  );

  if (message.pending && !message.content.trim()) {
    return null;
  }

  const messageClassName = [
    "ssb-message",
    `ssb-message--${message.role}`,
    message.error ? "ssb-message--error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={messageClassName}>
      <div className="ssb-message-bubble">
        <MessageRichContent parts={parts} onLeadCapture={onLeadLinkClick} />
      </div>
      {isAssistant && showLeadLink && !hasLeadCtaPart ? (
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
