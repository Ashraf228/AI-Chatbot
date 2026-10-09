export type WidgetPosition = "bottom-right" | "bottom-left";

export type WidgetTheme = {
  brandColor?: string;
  accentColor?: string;
  fontFamily?: string;
};

export type WidgetRuntimeConfig = {
  siteId: string;
  siteKey: string;
  publicKey: string;
  apiBase: string;
  title: string;
  companyName: string;
  botName: string;
  logoUrl: string;
  greeting: string;
  placeholder: string;
  buttonText: string;
  position: WidgetPosition;
  consentRequired: boolean;
  leadCaptureEnabled: boolean;
  theme: WidgetTheme;
  privacyUrl: string;
  suggestedQuestionsByPath: Record<string, string[]>;
};

export type WidgetGlobalConfig = Partial<WidgetRuntimeConfig> & {
  containerId?: string;
};
