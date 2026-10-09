import { useEffect, useState } from "react";
import { streamChatMessage } from "../services/messageService";
import { useAnalytics } from "./useAnalytics";
import { useMessages } from "./useMessages";
import { useWidgetConfig } from "./useWidgetConfig";
import { useSessionContext } from "../app/providers/SessionProvider";

function friendlyChatError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("HTTP 403")) {
    return "Diese Website ist für das Widget noch nicht freigegeben.";
  }

  if (message.includes("HTTP 429")) {
    return "Zu viele Anfragen in kurzer Zeit. Bitte warten Sie einen Moment.";
  }

  if (message.includes("HTTP 5")) {
    return "Der Assistent ist gerade nicht erreichbar. Bitte versuchen Sie es gleich erneut.";
  }

  return "Die Nachricht konnte gerade nicht zugestellt werden.";
}

export function useChat() {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const {
    setSessionId,
    consentAccepted,
    ensureSession,
  } = useSessionContext();
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
    void track("impression");
  }, [track]);

  async function sendMessage(content: string) {
    const text = content.trim();

    if (!text || isSending) {
      return;
    }

    if (config.consentRequired && !consentAccepted) {
      setError("Bitte stimmen Sie zuerst der Verarbeitung Ihrer Angaben zu, um den Chat zu starten.");
      return;
    }

    const session = await ensureSession();
    if (!session) {
      setError("Die Chat-Sitzung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.");
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
        sessionId: session.sessionId,
        visitorId: session.visitorId,
        message: text,
        onStart: (nextSessionId) => {
          if (nextSessionId && nextSessionId !== session.sessionId) {
            setSessionId(nextSessionId);
          }
        },
        onChunk: (delta) => {
          streamedAnswer += delta;
          updateAssistantMessage(placeholderId, streamedAnswer);
        },
      });

      if (reply.sessionId && reply.sessionId !== session.sessionId) {
        setSessionId(reply.sessionId);
      }

      resolveAssistantMessage(
        placeholderId,
        reply.answer || "(keine Antwort)",
        reply.sources,
        reply.parts,
      );
      await track("message_received", { sources: reply.sources?.length ?? 0 });
    } catch (err) {
      rejectAssistantMessage(placeholderId);
      setError(friendlyChatError(err));
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
