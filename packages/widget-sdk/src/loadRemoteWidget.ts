import type { BootstrapConfig, LoaderDataset } from "./types";

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

  const remoteConfig = (await response.json()) as Omit<BootstrapConfig, "widgetBundleUrl"> & {
    widgetBundleUrl?: string;
  };
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
  window.SSB_CHAT = {
    siteId: config.siteId,
    siteKey: config.siteKey,
    publicKey: config.publicKey,
    apiBase: config.apiBase,
    title: config.title,
    companyName: (config as any).companyName,
    botName: (config as any).botName,
    logoUrl: (config as any).logoUrl,
    greeting: config.greeting,
    placeholder: config.placeholder,
    buttonText: config.buttonText,
    position: config.position,
    consentRequired: config.consentRequired,
    leadCaptureEnabled: config.leadCaptureEnabled,
    theme: (config as any).theme,
    privacyUrl: (config as any).privacyUrl,
    suggestedQuestionsByPath: (config as any).suggestedQuestionsByPath,
    containerId: container.id,
  };
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
