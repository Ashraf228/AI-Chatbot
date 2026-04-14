import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import type { WidgetRuntimeConfig } from "../../types/config";

const ConfigContext = createContext<WidgetRuntimeConfig | null>(null);

export function ConfigProvider({
  children,
  config,
}: PropsWithChildren<{ config: WidgetRuntimeConfig }>) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfigContext() {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error("ConfigProvider missing");
  }

  return context;
}
