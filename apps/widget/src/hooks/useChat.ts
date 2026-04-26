import { useEffect, useState } from "react";
import { streamChatMessage } from "../services/messageService";
import { useAnalytics } from "./useAnalytics";
import { useMessages } from "./useMessages";
import { useWidgetConfig } from "./useWidgetConfig";
import { useSessionContext } from "../app/providers/SessionProvider";

export function useChat() {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const { sessionId, visitorId, setSessionId, consentAccepted } = useSessionContext();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    messages,
    appendUserMessage,
    appendAssistantMessage,
    appendAssistantPlaceholder,
    updateAssistantMessage,
    resolveAssistantMessage,
    rejectAssistantMessage,
  } = useMessages(config.greeting);

  useEffect(() => {
    void track("widget_loaded");
  }, [track]);

  async function sendMessage(content: string) {
    const text = content.trim();

    if (!text || isSending) {
      return;
    }

    if (config.consentRequired && !consentAccepted) {
      return;
    }

    appendUserMessage(text);
    const placeholderId = appendAssistantPlaceholder();
    setIsSending(true);
    setError(null);
    if (messages.filter((message) => message.role === "user").length === 0) {
      await track("chat_started", { trigger: "first_message" });
    }
    await track("message_sent", { length: text.length });

    try {
      let streamedAnswer = "";
      const reply = await streamChatMessage({
        config,
        sessionId,
        visitorId,
        message: text,
        onStart: (nextSessionId) => {
          if (nextSessionId && nextSessionId !== sessionId) {
            setSessionId(nextSessionId);
          }
        },
        onChunk: (delta) => {
          streamedAnswer += delta;
          updateAssistantMessage(placeholderId, streamedAnswer);
        },
      });

      if (reply.sessionId && reply.sessionId !== sessionId) {
        setSessionId(reply.sessionId);
      }

      resolveAssistantMessage(placeholderId, reply.answer || "(keine Antwort)", reply.sources);
      await track("message_received", { sources: reply.sources?.length ?? 0 });
    } catch {
      rejectAssistantMessage(placeholderId);
      setError("Die Nachricht konnte gerade nicht zugestellt werden.");
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages,
    isSending,
    error,
    sendMessage,
    appendAssistantMessage,
  };
}
