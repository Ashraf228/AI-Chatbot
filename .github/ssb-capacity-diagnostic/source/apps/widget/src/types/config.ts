import type {
  WidgetGlobalConfig,
  WidgetRuntimeConfig,
} from "../../../../packages/widget-sdk/src/runtime-config";

export type { WidgetGlobalConfig, WidgetRuntimeConfig };

export type WidgetMountOptions = {
  config?: WidgetGlobalConfig;
};
