import { postJson } from "./apiClient";
import type { ChatReply } from "../types/chat";
import type { WidgetRuntimeConfig } from "../types/config";

export async function sendChatMessage(params: {
  config: WidgetRuntimeConfig;
  sessionId: string;
  message: string;
}): Promise<ChatReply> {
  const { config, sessionId, message } = params;

  return postJson<ChatReply>(`${config.apiBase}/widget/chat/message`, {
    siteKey: config.siteKey,
    sessionId,
    message,
  });
}

export async function streamChatMessage(params: {
  config: WidgetRuntimeConfig;
  sessionId: string;
  visitorId: string;
  message: string;
  onStart?: (sessionId: string) => void;
  onChunk?: (delta: string) => void;
  onDone?: (reply: ChatReply) => void;
}): Promise<ChatReply> {
  const { config, sessionId, visitorId, message, onStart, onChunk, onDone } = params;

  const response = await fetch(`${config.apiBase}/widget/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteKey: config.siteKey,
      sessionId,
      visitorId,
      message,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let finalReply: ChatReply = { answer: "", sessionId, sources: [] };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const event = JSON.parse(line);

      if (event.type === "start" && event.sessionId) {
        finalReply.sessionId = event.sessionId;
        onStart?.(event.sessionId);
      }

      if (event.type === "chunk" && typeof event.delta === "string") {
        answer += event.delta;
        onChunk?.(event.delta);
      }

      if (event.type === "done") {
        finalReply = {
          answer: event.answer || answer,
          sessionId: event.sessionId || finalReply.sessionId,
          parts: event.parts || [],
          sources: event.sources || [],
        };
        onDone?.(finalReply);
      }

      if (event.type === "error") {
        throw new Error(event.message || "Streaming failed");
      }
    }

    if (done) {
      break;
    }
  }

  return finalReply;
}
