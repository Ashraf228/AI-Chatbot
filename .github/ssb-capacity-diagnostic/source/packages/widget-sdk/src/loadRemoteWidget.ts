import type { BootstrapConfig, LoaderDataset, RemoteWidgetConfig, WidgetGlobalConfig } from "./types";

function resolveBundleUrl(bundleUrl: string) {
  return new URL(bundleUrl, window.location.href).toString();
}

async function fetchRemoteConfig(dataset: LoaderDataset): Promise<BootstrapConfig> {
  const url = new URL(dataset.configPath, `${dataset.apiBase}/`);
  url.searchParams.set("siteKey", dataset.siteKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`[AI-Chatbot] Config request failed with HTTP ${response.status}`);
  }

  const remoteConfig = (await response.json()) as RemoteWidgetConfig;
  const widgetBundleUrl = dataset.widgetSrc || remoteConfig.widgetBundleUrl;

  if (!widgetBundleUrl) {
    throw new Error("[AI-Chatbot] Missing widget bundle URL");
  }

  return {
    ...remoteConfig,
    widgetBundleUrl,
  };
}

function assignRuntimeConfig(config: BootstrapConfig, container: HTMLDivElement) {
  const runtimeConfig: WidgetGlobalConfig = {
    siteId: config.siteId,
    siteKey: config.siteKey,
    publicKey: config.publicKey,
    apiBase: config.apiBase,
    title: config.title,
    companyName: config.companyName,
    botName: config.botName,
    logoUrl: config.logoUrl,
    greeting: config.greeting,
    placeholder: config.placeholder,
    buttonText: config.buttonText,
    position: config.position,
    consentRequired: config.consentRequired,
    leadCaptureEnabled: config.leadCaptureEnabled,
    theme: config.theme,
    privacyUrl: config.privacyUrl,
    suggestedQuestionsByPath: config.suggestedQuestionsByPath,
    containerId: container.id,
  };

  window.SSB_CHAT = runtimeConfig;
}

function injectWidgetScript(bundleUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const src = resolveBundleUrl(bundleUrl);
    const existing = document.querySelector(`script[data-ssb-widget-src="${src}"]`);

    if (existing instanceof HTMLScriptElement) {
      if (window.SSB_CHAT_MOUNTED) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("[AI-Chatbot] Widget bundle failed to load")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.ssbWidgetSrc = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("[AI-Chatbot] Widget bundle failed to load"));
    document.head.appendChild(script);
  });
}

export async function loadRemoteWidget(params: {
  dataset: LoaderDataset;
  container: HTMLDivElement;
}) {
  const config = await fetchRemoteConfig(params.dataset);
  assignRuntimeConfig(config, params.container);
  await injectWidgetScript(config.widgetBundleUrl);
  return config;
}
