export function decodeSiteId(siteId: string) {
  try {
    return decodeURIComponent(siteId);
  } catch {
    return siteId;
  }
}

export function encodeSiteId(siteId: string) {
  return encodeURIComponent(siteId);
}
