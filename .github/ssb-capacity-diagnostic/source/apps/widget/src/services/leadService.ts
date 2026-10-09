import type { LeadPayload } from "../types/lead";
import type { WidgetRuntimeConfig } from "../types/config";
import { postJson } from "./apiClient";

export async function submitLead(
  config: WidgetRuntimeConfig,
  sessionId: string,
  lead: LeadPayload,
) {
  return postJson(`${config.apiBase.replace(/\/$/, "")}/widget/leads`, {
    siteKey: config.siteKey,
    sessionId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone || "",
    message: lead.message || "",
    status: "new",
  });
}
