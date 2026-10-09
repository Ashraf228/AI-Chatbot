export function resolveWidgetLoaderUrl(configured?: string) {
  const trimmed = configured?.trim();
  const hasUsableConfiguredUrl =
    trimmed && !trimmed.includes("localhost") && !trimmed.includes("127.0.0.1");

  if (hasUsableConfiguredUrl) {
    return trimmed;
  }

  if (typeof window === "undefined") {
    return trimmed || "http://localhost:8080/loader.js";
  }

  const { protocol, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return trimmed || "http://localhost:8080/loader.js";
  }

  const widgetHost = hostname.startsWith("app.")
    ? hostname.replace(/^app\./, "widget.")
    : `widget.${hostname}`;

  return `${protocol}//${widgetHost}/loader.js`;
}
