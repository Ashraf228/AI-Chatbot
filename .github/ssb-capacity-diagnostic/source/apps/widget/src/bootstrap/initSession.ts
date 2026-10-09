import {
  cleanupWidgetIdentifiers,
  getStoredConsent,
  getStoredSessionId,
  getStoredVisitorId,
  persistSessionId,
  persistVisitorId,
} from "../services/sessionService";
import { sanitizeBrowserUrl } from "../services/urlSanitizer";
import type { WidgetRuntimeConfig } from "../types/config";

export type WidgetSessionBootstrap = {
  sessionId: string | null;
  visitorId: string | null;
  consentAccepted: boolean;
  sessionStatus: "not_started" | "ready" | "failed";
};

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export type WidgetSessionReady = {
  sessionId: string;
  visitorId: string;
};

const inFlightSessions = new Map<string, Promise<WidgetSessionReady>>();

function canInitializeSession(config: WidgetRuntimeConfig) {
  return !config.consentRequired || getStoredConsent(config.siteId);
}

async function createOrReuseSession(config: WidgetRuntimeConfig): Promise<WidgetSessionReady> {
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
        sourceUrl: typeof window !== "undefined" ? sanitizeBrowserUrl(window.location.href) : "",
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
  };
}

export async function ensureSession(config: WidgetRuntimeConfig): Promise<WidgetSessionReady | null> {
  if (!canInitializeSession(config)) {
    cleanupWidgetIdentifiers(config.siteId);
    return null;
  }

  const key = `${config.apiBase}:${config.siteKey}:${config.siteId}`;
  const existing = inFlightSessions.get(key);
  if (existing) {
    return existing;
  }

  const promise = createOrReuseSession(config);
  inFlightSessions.set(key, promise);

  try {
    return await promise;
  } catch (error) {
    inFlightSessions.delete(key);
    throw error;
  }
}

export async function initSession(config: WidgetRuntimeConfig): Promise<WidgetSessionBootstrap> {
  const consentAccepted = !config.consentRequired || getStoredConsent(config.siteId);

  if (!consentAccepted) {
    cleanupWidgetIdentifiers(config.siteId);
    return {
      sessionId: null,
      visitorId: null,
      consentAccepted: false,
      sessionStatus: "not_started",
    };
  }

  try {
    const session = await ensureSession(config);
    return {
      sessionId: session?.sessionId ?? null,
      visitorId: session?.visitorId ?? null,
      consentAccepted,
      sessionStatus: session ? "ready" : "not_started",
    };
  } catch {
    return {
      sessionId: null,
      visitorId: null,
      consentAccepted,
      sessionStatus: "failed",
    };
  }
}
