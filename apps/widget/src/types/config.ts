export type WidgetRuntimeConfig = {
  siteId: string;
  siteKey: string;
  publicKey: string;
  apiBase: string;
  title: string;
  companyName?: string;
  botName?: string;
  logoUrl?: string;
  greeting: string;
  placeholder: string;
  buttonText: string;
  position: "bottom-right" | "bottom-left";
  consentRequired: boolean;
  leadCaptureEnabled: boolean;
  theme?: {
    brandColor?: string;
    accentColor?: string;
  };
  privacyUrl?: string;
  suggestedQuestionsByPath?: Record<string, string[]>;
};

export type WidgetGlobalConfig = Partial<WidgetRuntimeConfig>;

export type WidgetMountOptions = {
  config?: WidgetGlobalConfig;
};
