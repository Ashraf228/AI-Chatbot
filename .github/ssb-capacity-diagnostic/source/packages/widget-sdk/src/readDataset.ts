import type { LoaderDataset } from "./types";
const defaultConfigPath = "/widget/config";

function readDatasetValue(element: HTMLScriptElement, attribute: string) {
  const dataKey = `data-${attribute.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
  return element.dataset[attribute] || element.getAttribute(dataKey) || "";
}

export function getCurrentLoaderScript(): HTMLScriptElement {
  const currentScript = document.currentScript;

  if (currentScript instanceof HTMLScriptElement) {
    return currentScript;
  }

  const fallback = document.querySelector("script[data-site-key]");

  if (!(fallback instanceof HTMLScriptElement)) {
    throw new Error("[AI-Chatbot] Loader script tag with data-site-key not found");
  }

  return fallback;
}

export function readDataset(script: HTMLScriptElement): LoaderDataset {
  const siteKey = readDatasetValue(script, "siteKey").trim();
  const scriptUrl = script.src ? new URL(script.src, window.location.href) : null;
  const inferredApiBase = scriptUrl?.origin || window.location.origin;
  const apiBase = (readDatasetValue(script, "apiBase").trim() || inferredApiBase).replace(/\/$/, "");
  const configPath = readDatasetValue(script, "configPath").trim() || defaultConfigPath;
  const widgetSrc = readDatasetValue(script, "widgetSrc").trim() || undefined;

  if (!siteKey) {
    throw new Error("[AI-Chatbot] Missing required data-site-key");
  }

  return {
    siteKey,
    apiBase,
    configPath,
    widgetSrc,
  };
}
