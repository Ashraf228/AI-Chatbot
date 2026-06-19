const consentPrefix = "ssb_consent_";
const sessionPrefix = "ssb_session_";
const visitorPrefix = "ssb_visitor_";

function getStorageKey(prefix: string, siteId: string) {
  return `${prefix}${siteId}`;
}

function storageAvailable(storage: Storage | undefined): storage is Storage {
  return typeof storage !== "undefined";
}

function removeStorageKey(storage: Storage | undefined, key: string) {
  if (!storageAvailable(storage)) {
    return;
  }

  storage.removeItem(key);
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

export function cleanupWidgetIdentifiers(siteId: string) {
  const sessionKey = getStorageKey(sessionPrefix, siteId);
  const visitorKey = getStorageKey(visitorPrefix, siteId);

  removeStorageKey(window.localStorage, sessionKey);
  removeStorageKey(window.localStorage, visitorKey);
  removeStorageKey(window.sessionStorage, sessionKey);
  removeStorageKey(window.sessionStorage, visitorKey);

  document.cookie = `${sessionKey}=; Max-Age=0; path=/; SameSite=Lax`;
  document.cookie = `${visitorKey}=; Max-Age=0; path=/; SameSite=Lax`;
}
