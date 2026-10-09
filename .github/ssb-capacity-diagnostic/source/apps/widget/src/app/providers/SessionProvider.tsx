import { createContext, useContext, useState } from "react";
import type { PropsWithChildren } from "react";
import {
  ensureSession as ensureWidgetSession,
  type WidgetSessionBootstrap,
  type WidgetSessionReady,
} from "../../bootstrap/initSession";
import {
  cleanupWidgetIdentifiers,
  getStoredConsent,
  persistConsent,
  persistSessionId,
} from "../../services/sessionService";
import { useConfigContext } from "./ConfigProvider";

type SessionStatus = "not_started" | "initializing" | "ready" | "failed";

type SessionContextValue = {
  sessionId: string | null;
  visitorId: string | null;
  consentAccepted: boolean;
  sessionStatus: SessionStatus;
  sessionError: string | null;
  setSessionId: (value: string) => void;
  ensureSession: () => Promise<WidgetSessionReady | null>;
  acceptConsent: () => Promise<WidgetSessionReady | null>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialSession,
}: PropsWithChildren<{ initialSession: WidgetSessionBootstrap }>) {
  const config = useConfigContext();
  const [sessionId, setSessionIdState] = useState(initialSession.sessionId);
  const [visitorId, setVisitorId] = useState(initialSession.visitorId);
  const [consentAccepted, setConsentAccepted] = useState(initialSession.consentAccepted);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initialSession.sessionStatus);
  const [sessionError, setSessionError] = useState<string | null>(null);

  function setSessionId(value: string) {
    setSessionIdState(value);
    persistSessionId(config.siteId, value);
  }

  async function ensureSession() {
    if (config.consentRequired && !consentAccepted && !getStoredConsent(config.siteId)) {
      cleanupWidgetIdentifiers(config.siteId);
      return null;
    }

    setSessionStatus((current) => (current === "ready" ? current : "initializing"));
    setSessionError(null);

    try {
      const session = await ensureWidgetSession(config);
      if (!session) {
        setSessionStatus("not_started");
        return null;
      }

      setSessionIdState(session.sessionId);
      setVisitorId(session.visitorId);
      setSessionStatus("ready");
      return session;
    } catch {
      setSessionStatus("failed");
      setSessionError("Die Chat-Sitzung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.");
      return null;
    }
  }

  async function acceptConsent() {
    persistConsent(config.siteId);
    if (!sessionId || sessionStatus !== "ready") {
      cleanupWidgetIdentifiers(config.siteId);
    }
    setConsentAccepted(true);
    setSessionStatus("initializing");
    setSessionError(null);

    try {
      const session = await ensureWidgetSession(config);
      if (!session) {
        setSessionStatus("not_started");
        return null;
      }

      setSessionIdState(session.sessionId);
      setVisitorId(session.visitorId);
      setSessionStatus("ready");
      return session;
    } catch {
      setSessionStatus("failed");
      setSessionError("Die Chat-Sitzung konnte nicht gestartet werden. Bitte versuchen Sie es erneut.");
      return null;
    }
  }

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        visitorId,
        consentAccepted,
        sessionStatus,
        sessionError,
        setSessionId,
        ensureSession,
        acceptConsent,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("SessionProvider missing");
  }

  return context;
}
