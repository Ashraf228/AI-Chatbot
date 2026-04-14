const consentPrefix = "ssb_consent_";
const sessionPrefix = "ssb_session_";
const visitorPrefix = "ssb_visitor_";

function getStorageKey(prefix: string, siteId: string) {
  return `${prefix}${siteId}`;
}

export function getStoredSessionId(siteId: string): string | null {
  return window.localStorage.getItem(getStorageKey(sessionPrefix, siteId));
}

export function persistSessionId(siteId: string, sessionId: string) {
  window.localStorage.setItem(getStorageKey(sessionPrefix, siteId), sessionId);
}

export function getStoredVisitorId(siteId: string): string | null {
  return window.localStorage.getItem(getStorageKey(visitorPrefix, siteId));
}

export function persistVisitorId(siteId: string, visitorId: string) {
  window.localStorage.setItem(getStorageKey(visitorPrefix, siteId), visitorId);
}

export function getStoredConsent(siteId: string): boolean {
  return window.localStorage.getItem(getStorageKey(consentPrefix, siteId)) === "accepted";
}

export function persistConsent(siteId: string) {
  window.localStorage.setItem(getStorageKey(consentPrefix, siteId), "accepted");
}
