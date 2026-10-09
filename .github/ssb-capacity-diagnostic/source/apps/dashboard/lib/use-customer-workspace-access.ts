"use client";

import { useEffect, useState } from "react";
import type { DashboardSessionRole } from "./auth";

// Display state only; each workspace request still requires server authorization.
export function useCustomerWorkspaceAccess(siteId: string, role: DashboardSessionRole | null | undefined) {
  const [allowedSiteId, setAllowedSiteId] = useState<string | null>(null);

  useEffect(() => {
    setAllowedSiteId(null);
    if (role !== "customer" || !siteId) return;

    const controller = new AbortController();
    void fetch(`/api/sites/${encodeURIComponent(siteId)}/conversation-engine/demo-workspace/access`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) setAllowedSiteId(response.ok ? siteId : null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAllowedSiteId(null);
      });

    return () => controller.abort();
  }, [role, siteId]);

  return role === "customer" && Boolean(siteId) && allowedSiteId === siteId;
}
