import { initHostedWidget } from "./public-api";

export { initHostedWidget } from "./public-api";

if (typeof window !== "undefined") {
  void initHostedWidget();
}
