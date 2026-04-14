import type { WidgetGlobalConfig, WidgetRuntimeConfig } from "../types/config";

declare global {
  interface Window {
    SSB_CHAT?: WidgetGlobalConfig;
    SSB_CHAT_MOUNTED?: boolean;
  }
}

const defaultConfig: Omit<WidgetRuntimeConfig, "siteId" | "siteKey" | "publicKey"> = {
  apiBase: "http://localhost:5000",
  title: "Support",
  companyName: "Support",
  botName: "Service-Assistent",
  logoUrl: "",
  greeting: "Hi! Wie kann ich helfen?",
  placeholder: "Nachricht schreiben...",
  buttonText: "Chat",
  position: "bottom-right",
  consentRequired: false,
  leadCaptureEnabled: false,
  theme: {
    brandColor: "#b55400",
    accentColor: "#fff0d9",
  },
  privacyUrl: "",
  suggestedQuestionsByPath: {},
};

export function loadConfig(override?: WidgetGlobalConfig): WidgetRuntimeConfig {
  const runtimeConfig = {
    ...defaultConfig,
    ...(window.SSB_CHAT ?? {}),
    ...(override ?? {}),
  };

  if (!runtimeConfig.siteId) {
    throw new Error("[SSB_CHAT] Missing siteId");
  }

  if (!runtimeConfig.siteKey) {
    throw new Error("[SSB_CHAT] Missing siteKey");
  }

  if (!runtimeConfig.publicKey) {
    throw new Error("[SSB_CHAT] Missing publicKey");
  }

  return runtimeConfig as WidgetRuntimeConfig;
}
