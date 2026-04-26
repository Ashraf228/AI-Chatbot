import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

type MessageListProps = {
  messages: ChatMessage[];
  contactCtaMessageId?: string | null;
  onContactCtaClick?: () => void | Promise<void>;
};

export function MessageList({
  messages,
  contactCtaMessageId,
  onContactCtaClick,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <div ref={listRef} className="ssb-message-list">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          showLeadLink={message.id === contactCtaMessageId}
          onLeadLinkClick={onContactCtaClick}
        />
      ))}
    </div>
  );
}
