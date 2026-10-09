import { useEffect, useMemo, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const latestAssistantText = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.role === "assistant" && !message.pending && message.content.trim());
    return latest ? `Antwort des Assistenten: ${latest.content}` : "";
  }, [messages]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <>
      <div className="ssb-sr-only" aria-live="polite" aria-atomic="true">
        {latestAssistantText}
      </div>
      <div ref={listRef} className="ssb-message-list" role="log" aria-label="Chatverlauf" aria-live="off" aria-busy={messages.some((message) => message.pending)}>
        <ul className="ssb-message-list__items">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
            />
          ))}
        </ul>
      </div>
    </>
  );
}
