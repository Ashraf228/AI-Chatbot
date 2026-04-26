export type WidgetEventName =
  | "widget_loaded"
  | "widget_opened"
  | "widget_closed"
  | "chat_started"
  | "message_sent"
  | "message_received"
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
