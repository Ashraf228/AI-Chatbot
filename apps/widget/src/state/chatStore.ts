import type { ChatMessage } from "../types/chat";

export type ChatState = {
  messages: ChatMessage[];
  isSending: boolean;
};

export function createChatStore(initial?: Partial<ChatState>): ChatState {
  return {
    messages: initial?.messages ?? [],
    isSending: initial?.isSending ?? false,
  };
}
