import { mountWidget } from "./bootstrap/mountWidget";

export { mountWidget } from "./bootstrap/mountWidget";

if (typeof window !== "undefined" && !window.SSB_CHAT_MOUNTED) {
  mountWidget();
}
