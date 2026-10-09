const containerId = "ssb-chat-loader-root";

export function injectContainer() {
  const existing = document.getElementById(containerId);

  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const container = document.createElement("div");
  container.id = containerId;
  container.dataset.ssbLoader = "true";
  document.body.appendChild(container);

  return container;
}
