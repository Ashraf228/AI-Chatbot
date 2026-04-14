export type MessageRole = "user" | "assistant" | "system";

export type MessageSource = {
  title?: string;
  url?: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  sources?: MessageSource[];
  createdAt: string;
  pending?: boolean;
  error?: boolean;
};

export type ChatReply = {
  answer: string;
  sessionId?: string;
  sources?: MessageSource[];
};
