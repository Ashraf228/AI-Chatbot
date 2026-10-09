const styleId = "ssb-chat-loader-styles";

const loaderCss = `
#ssb-chat-loader-root {
  position: fixed;
  inset: auto 0 0 auto;
  z-index: 2147483646;
  pointer-events: none;
}
`;

export function injectStyles() {
  const existing = document.getElementById(styleId);

  if (existing instanceof HTMLStyleElement) {
    return existing;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = loaderCss;
  document.head.appendChild(style);

  return style;
}
