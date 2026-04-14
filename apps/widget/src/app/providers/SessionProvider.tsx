import { createContext, useContext, useState } from "react";
import type { PropsWithChildren } from "react";
import type { WidgetSessionBootstrap } from "../../bootstrap/initSession";
import { persistConsent, persistSessionId } from "../../services/sessionService";
import { useConfigContext } from "./ConfigProvider";

type SessionContextValue = {
  sessionId: string;
  visitorId: string;
  consentAccepted: boolean;
  setSessionId: (value: string) => void;
  acceptConsent: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialSession,
}: PropsWithChildren<{ initialSession: WidgetSessionBootstrap }>) {
  const config = useConfigContext();
  const [sessionId, setSessionIdState] = useState(initialSession.sessionId);
  const [visitorId] = useState(initialSession.visitorId);
  const [consentAccepted, setConsentAccepted] = useState(initialSession.consentAccepted);

  function setSessionId(value: string) {
    setSessionIdState(value);
    persistSessionId(config.siteId, value);
  }

  function acceptConsent() {
    setConsentAccepted(true);
    persistConsent(config.siteId);
  }

  return (
    <SessionContext.Provider
      value={{ sessionId, visitorId, consentAccepted, setSessionId, acceptConsent }}
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
