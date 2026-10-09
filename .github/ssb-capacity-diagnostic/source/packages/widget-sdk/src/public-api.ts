import { injectContainer } from "./injectContainer";
import { injectStyles } from "./injectStyles";
import { loadRemoteWidget } from "./loadRemoteWidget";
import { getCurrentLoaderScript, readDataset } from "./readDataset";
import type { HostedWidgetHandle, LoaderDataset } from "./types";

export async function initHostedWidget(script?: HTMLScriptElement): Promise<HostedWidgetHandle | undefined> {
  if (window.SSB_CHAT_LOADING || window.SSB_CHAT_MOUNTED) {
    return undefined;
  }

  window.SSB_CHAT_LOADING = true;

  try {
    const loaderScript = script ?? getCurrentLoaderScript();
    const dataset: LoaderDataset = readDataset(loaderScript);
    const container = injectContainer();
    injectStyles();
    const config = await loadRemoteWidget({ dataset, container });

    return {
      container,
      dataset,
      config,
    };
  } catch (error) {
    console.error(error);
    return undefined;
  } finally {
    window.SSB_CHAT_LOADING = false;
  }
}
