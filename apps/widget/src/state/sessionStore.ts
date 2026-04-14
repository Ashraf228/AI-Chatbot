export type SessionState = {
  sessionId: string;
  consentAccepted: boolean;
};

export function createSessionStore(initial: SessionState): SessionState {
  return initial;
}
