import { useEffect, useState } from "react";
import type { ChatMessage, MessageSource } from "../types/chat";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createMessage(
  role: ChatMessage["role"],
  content: string,
  options?: { pending?: boolean; error?: boolean; sources?: MessageSource[] },
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    sources: options?.sources,
    pending: options?.pending,
    error: options?.error,
    createdAt: new Date().toISOString(),
  };
}

export function useMessages(greeting: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    setMessages([createMessage("assistant", greeting)]);
  }, [greeting, messages.length]);

  function appendUserMessage(content: string) {
    const message = createMessage("user", content);
    setMessages((current) => [...current, message]);
    return message;
  }

  function appendAssistantMessage(content: string, sources?: MessageSource[]) {
    const message = createMessage("assistant", content, { sources });
    setMessages((current) => [...current, message]);
    return message;
  }

  function appendAssistantPlaceholder() {
    const placeholder = createMessage("assistant", "", { pending: true });
    setMessages((current) => [...current, placeholder]);
    return placeholder.id;
  }

  function updateAssistantMessage(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content, pending: true, error: false }
          : message,
      ),
    );
  }

  function resolveAssistantMessage(messageId: string, content: string, sources?: MessageSource[]) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, content, sources, pending: false, error: false }
          : message,
      ),
    );
  }

  function rejectAssistantMessage(messageId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: "Fehler beim Verbinden. Bitte spaeter erneut versuchen.",
              pending: false,
              error: true,
            }
          : message,
      ),
    );
  }

  return {
    messages,
    appendUserMessage,
    appendAssistantMessage,
    appendAssistantPlaceholder,
    updateAssistantMessage,
    resolveAssistantMessage,
    rejectAssistantMessage,
  };
}
