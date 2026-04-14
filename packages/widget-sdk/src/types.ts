export type LoaderDataset = {
  siteKey: string;
  apiBase: string;
  configPath: string;
  widgetSrc?: string;
};

export type RemoteWidgetConfig = {
  siteId: string;
  siteKey: string;
  publicKey: string;
  apiBase: string;
  title?: string;
  greeting?: string;
  placeholder?: string;
  buttonText?: string;
  position?: "bottom-right" | "bottom-left";
  consentRequired?: boolean;
  leadCaptureEnabled?: boolean;
  widgetBundleUrl?: string;
};

export type BootstrapConfig = RemoteWidgetConfig & {
  widgetBundleUrl: string;
};

export type HostedWidgetHandle = {
  container: HTMLDivElement;
  dataset: LoaderDataset;
  config: BootstrapConfig;
};

declare global {
  interface Window {
    SSB_CHAT?: Record<string, unknown>;
    SSB_CHAT_MOUNTED?: boolean;
    SSB_CHAT_LOADING?: boolean;
  }
}
