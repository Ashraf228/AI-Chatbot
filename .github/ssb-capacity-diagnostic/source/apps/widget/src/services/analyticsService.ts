import type { WidgetEvent } from "../types/analytics";
import { sanitizeBrowserUrl } from "./urlSanitizer";

export async function trackWidgetEvent(event: WidgetEvent) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ssb:analytics", { detail: event }));
  }

  const pageUrl = typeof window !== "undefined" ? sanitizeBrowserUrl(window.location.href) : "";
  await fetch(`${event.apiBase.replace(/\/$/, "")}/widget/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      siteKey: event.siteKey,
      sessionId: event.sessionId,
      eventType: event.name,
      pageUrl,
      metadata: event.metadata || {},
    }),
  }).catch(() => undefined);

  if (import.meta.env.DEV) {
    console.debug("[widget analytics]", {
      name: event.name,
      siteKey: event.siteKey,
      hasSession: Boolean(event.sessionId),
    });
  }
}
