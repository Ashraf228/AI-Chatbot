export type WidgetEventName =
  | "impression"
  | "open"
  | "close"
  | "chat_started"
  | "message_sent"
  | "message_received"
  | "fallback"
  | "lead_modal_opened"
  | "lead_submitted"
  | "consent_accepted";

export type WidgetEvent = {
  name: WidgetEventName;
  siteId: string;
  siteKey: string;
  apiBase: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
