import { createRoot } from "react-dom/client";
import { WidgetApp } from "../app/WidgetApp";
import { loadConfig } from "./loadConfig";
import { createContainer } from "./createContainer";
import { initSession } from "./initSession";
import type { WidgetMountOptions } from "../types/config";
import baseCss from "../styles/base.css?inline";
import themeCss from "../styles/theme.css?inline";
import widgetCss from "../styles/widget.css?inline";
import { createElement } from "react";

function injectStyles(target: ShadowRoot) {
  const styleTag = document.createElement("style");
  styleTag.textContent = [baseCss, themeCss, widgetCss].join("\n");
  target.appendChild(styleTag);
}

function injectThemeVariables(target: ShadowRoot, config: ReturnType<typeof loadConfig>) {
  const themeTag = document.createElement("style");
  themeTag.textContent = `
    :host, :root {
      --ssb-color-primary: ${config.theme?.brandColor || "#b55400"};
      --ssb-color-primary-strong: ${config.theme?.brandColor || "#8f4300"};
      --ssb-color-primary-soft: ${config.theme?.accentColor || "#ffe2c4"};
    }
  `;
  target.appendChild(themeTag);
}

export function mountWidget(options?: WidgetMountOptions) {
  const config = loadConfig(options?.config);
  const container = createContainer();

  injectStyles(container.shadowRoot);
  injectThemeVariables(container.shadowRoot, config);

  const root = createRoot(container.mountNode);
  root.render(createElement("div", { className: "ssb-widget-boot" }, "Widget wird geladen ..."));

  const mount = async () => {
    const session = await initSession(config);
    root.render(createElement(WidgetApp, { config, initialSession: session }));
    window.SSB_CHAT_MOUNTED = true;
    return { root, container, config, session };
  };

  return mount();
}
