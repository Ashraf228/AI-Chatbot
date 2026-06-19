export function sanitizeBrowserUrl(value?: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}
