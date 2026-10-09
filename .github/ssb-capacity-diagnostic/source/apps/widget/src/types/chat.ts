export type MessageRole = "user" | "assistant" | "system";

export type MessageSource = {
  title?: string;
  url?: string;
};

export type ChatMessagePart =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "product-card";
      title: string;
      url: string;
      vendor?: string;
      productType?: string;
      price?: string;
      availability?: "available" | "unavailable";
      variantSummary?: string;
    }
  | {
      kind: "collection-card";
      title: string;
      url: string;
      productCount?: number;
    }
  | {
      kind: "variant-card";
      title: string;
      url: string;
      price?: string;
      availability?: "available" | "unavailable";
    }
  | {
      kind: "link";
      text: string;
      url: string;
    }
  | {
      kind: "source-card";
      title: string;
      url: string;
    }
  | {
      kind: "cta";
      action: "lead_capture";
      label: string;
      description?: string;
    };

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  parts?: ChatMessagePart[];
  sources?: MessageSource[];
  createdAt: string;
  pending?: boolean;
  error?: boolean;
};

export type ChatReply = {
  answer: string;
  sessionId?: string;
  parts?: ChatMessagePart[];
  sources?: MessageSource[];
};
