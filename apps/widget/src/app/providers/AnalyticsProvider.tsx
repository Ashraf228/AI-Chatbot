import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import { trackWidgetEvent } from "../../services/analyticsService";
import { getStoredConsent } from "../../services/sessionService";
import type { WidgetEvent, WidgetEventName } from "../../types/analytics";
import { useConfigContext } from "./ConfigProvider";
import { useSessionContext } from "./SessionProvider";

type AnalyticsContextValue = {
  track: (name: WidgetEventName, metadata?: Record<string, unknown>) => Promise<void>;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({ children }: PropsWithChildren) {
  const config = useConfigContext();
  const { consentAccepted, ensureSession } = useSessionContext();

  async function track(name: WidgetEventName, metadata?: Record<string, unknown>) {
    if (config.consentRequired && !consentAccepted && !getStoredConsent(config.siteId)) {
      return;
    }

    const session = await ensureSession();
    if (!session) {
      return;
    }

    const event: WidgetEvent = {
      name,
      siteId: config.siteId,
      siteKey: config.siteKey,
      apiBase: config.apiBase,
      sessionId: session.sessionId,
      metadata,
      createdAt: new Date().toISOString(),
    };

    await trackWidgetEvent(event);
  }

  return <AnalyticsContext.Provider value={{ track }}>{children}</AnalyticsContext.Provider>;
}

export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error("AnalyticsProvider missing");
  }

  return context;
}
