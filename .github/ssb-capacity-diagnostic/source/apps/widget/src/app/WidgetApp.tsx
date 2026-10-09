import type { WidgetSessionBootstrap } from "../bootstrap/initSession";
import type { WidgetRuntimeConfig } from "../types/config";
import { WidgetShell } from "./WidgetShell";
import { AnalyticsProvider } from "./providers/AnalyticsProvider";
import { ConfigProvider } from "./providers/ConfigProvider";
import { SessionProvider } from "./providers/SessionProvider";

export function WidgetApp({
  config,
  initialSession,
}: {
  config: WidgetRuntimeConfig;
  initialSession: WidgetSessionBootstrap;
}) {
  return (
    <ConfigProvider config={config}>
      <SessionProvider initialSession={initialSession}>
        <AnalyticsProvider>
          <WidgetShell />
        </AnalyticsProvider>
      </SessionProvider>
    </ConfigProvider>
  );
}
