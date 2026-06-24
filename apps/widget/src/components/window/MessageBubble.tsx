import type { ChatMessage } from "../../types/chat";
import { buildMessageParts } from "../../renderers/messageParts";
import { MessageRichContent } from "../rich-content/MessageRichContent";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const parts = buildMessageParts(message);

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
    <li className={messageClassName} aria-label={`${message.role === "user" ? "Besucher" : "Assistent"} Nachricht`}>
      <span className="ssb-message-speaker">{message.role === "user" ? "Besucher" : "Assistent"}</span>
      <div className="ssb-message-bubble">
        <MessageRichContent parts={parts} />
      </div>
    </li>
  );
}
