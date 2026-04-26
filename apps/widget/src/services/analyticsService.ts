import type { WidgetEvent } from "../types/analytics";

function mapEventType(name: WidgetEvent["name"]) {
  switch (name) {
    case "widget_loaded":
      return "impression";
    case "widget_opened":
      return "open";
    case "widget_closed":
      return "close";
    case "chat_started":
      return "chat_started";
    case "message_sent":
      return "message_sent";
    case "message_received":
      return "message_received";
    case "lead_modal_opened":
      return "lead_modal_opened";
    case "lead_submitted":
      return "lead_submitted";
    case "consent_accepted":
      return "consent_accepted";
    default:
      return name;
  }
}

export async function trackWidgetEvent(event: WidgetEvent) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ssb:analytics", { detail: event }));
  }

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  await fetch(`${event.apiBase.replace(/\/$/, "")}/widget/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteKey: event.siteKey,
      sessionId: event.sessionId,
      eventType: mapEventType(event.name),
      pageUrl,
      metadata: event.metadata || {},
    }),
  }).catch(() => undefined);

  if (import.meta.env.DEV) {
    console.debug("[widget analytics]", event);
  }
}
