import { useAnalyticsContext } from "../app/providers/AnalyticsProvider";

export function useAnalytics() {
  return useAnalyticsContext();
}
