export type WidgetContainer = {
  host: HTMLDivElement;
  shadowRoot: ShadowRoot;
  mountNode: HTMLDivElement;
};

export function createContainer(): WidgetContainer {
  const existing = document.getElementById("ssb-chat-host");

  if (existing) {
    existing.remove();
  }

  const host = document.createElement("div");
  host.id = "ssb-chat-host";
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: "open" });
  const mountNode = document.createElement("div");
  mountNode.id = "ssb-chat-root";
  shadowRoot.appendChild(mountNode);

  return { host, shadowRoot, mountNode };
}
