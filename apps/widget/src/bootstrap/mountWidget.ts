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

function hexToRgbTriplet(color: string) {
  const hex = color.replace("#", "").trim();

  if (hex.length !== 3 && hex.length !== 6) {
    return "181, 84, 0";
  }

  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;

  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) {
    return "181, 84, 0";
  }

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r}, ${g}, ${b}`;
}

function injectThemeVariables(target: ShadowRoot, config: ReturnType<typeof loadConfig>) {
  const brandColor = config.theme?.brandColor || "#b55400";
  const accentColor = config.theme?.accentColor || "#ffe2c4";
  const primaryRgb = hexToRgbTriplet(brandColor);

  const themeTag = document.createElement("style");
  themeTag.textContent = `
    :host, :root {
      --ssb-color-primary: ${brandColor};
      --ssb-color-primary-strong: ${brandColor};
      --ssb-color-primary-soft: ${accentColor};
      --ssb-color-primary-rgb: ${primaryRgb};
      --ssb-color-panel: ${accentColor};
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
