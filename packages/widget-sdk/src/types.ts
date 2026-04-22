import type { WidgetGlobalConfig, WidgetRuntimeConfig } from "./runtime-config";
export type { WidgetGlobalConfig, WidgetRuntimeConfig, WidgetPosition, WidgetTheme } from "./runtime-config";

export type LoaderDataset = {
  siteKey: string;
  apiBase: string;
  configPath: string;
  widgetSrc?: string;
};

export type RemoteWidgetConfig = WidgetRuntimeConfig & {
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
    SSB_CHAT?: WidgetGlobalConfig;
    SSB_CHAT_MOUNTED?: boolean;
    SSB_CHAT_LOADING?: boolean;
  }
}
