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
    fontFamily: "system",
  },
  privacyUrl: "",
  suggestedQuestionsByPath: {},
};

export function loadConfig(override?: WidgetGlobalConfig): WidgetRuntimeConfig {
  const runtimeConfig: WidgetGlobalConfig = {
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

  return {
    siteId: runtimeConfig.siteId,
    siteKey: runtimeConfig.siteKey,
    publicKey: runtimeConfig.publicKey,
    apiBase: runtimeConfig.apiBase ?? defaultConfig.apiBase,
    title: runtimeConfig.title ?? defaultConfig.title,
    companyName: runtimeConfig.companyName ?? defaultConfig.companyName,
    botName: runtimeConfig.botName ?? defaultConfig.botName,
    logoUrl: runtimeConfig.logoUrl ?? defaultConfig.logoUrl,
    greeting: runtimeConfig.greeting ?? defaultConfig.greeting,
    placeholder: runtimeConfig.placeholder ?? defaultConfig.placeholder,
    buttonText: runtimeConfig.buttonText ?? defaultConfig.buttonText,
    position: runtimeConfig.position ?? defaultConfig.position,
    consentRequired: runtimeConfig.consentRequired ?? defaultConfig.consentRequired,
    leadCaptureEnabled: runtimeConfig.leadCaptureEnabled ?? defaultConfig.leadCaptureEnabled,
    theme: runtimeConfig.theme ?? defaultConfig.theme,
    privacyUrl: runtimeConfig.privacyUrl ?? defaultConfig.privacyUrl,
    suggestedQuestionsByPath:
      runtimeConfig.suggestedQuestionsByPath ?? defaultConfig.suggestedQuestionsByPath,
  };
}
