import {
  getStoredConsent,
  getStoredSessionId,
  getStoredVisitorId,
  persistSessionId,
  persistVisitorId,
} from "../services/sessionService";
import type { WidgetRuntimeConfig } from "../types/config";

export type WidgetSessionBootstrap = {
  sessionId: string;
  visitorId: string;
  consentAccepted: boolean;
};

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function initSession(config: WidgetRuntimeConfig): Promise<WidgetSessionBootstrap> {
  let visitorId = getStoredVisitorId(config.siteId);
  if (!visitorId) {
    visitorId = createSessionId();
    persistVisitorId(config.siteId, visitorId);
  }

  let sessionId = getStoredSessionId(config.siteId);

  if (!sessionId) {
    const response = await fetch(`${config.apiBase}/widget/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        siteKey: config.siteKey,
        visitorId,
        sourceUrl: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Session init failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as { id: string; visitorId?: string };
    sessionId = data.id;
    if (data.visitorId) {
      visitorId = data.visitorId;
      persistVisitorId(config.siteId, visitorId);
    }
    persistSessionId(config.siteId, sessionId);
  }

  return {
    sessionId,
    visitorId,
    consentAccepted: getStoredConsent(config.siteId),
  };
}
