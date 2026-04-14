import { useConfigContext } from "../app/providers/ConfigProvider";

export function useWidgetConfig() {
  return useConfigContext();
}
