import { useState } from "react";
import { submitLead } from "../services/leadService";
import type { LeadPayload, LeadSubmissionState } from "../types/lead";
import { useWidgetConfig } from "./useWidgetConfig";
import { useAnalytics } from "./useAnalytics";
import { useSessionContext } from "../app/providers/SessionProvider";

export function useLeadCapture(messageCount: number) {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const { sessionId } = useSessionContext();
  const [state, setState] = useState<LeadSubmissionState>("idle");

  const shouldShowLeadForm =
    config.leadCaptureEnabled && messageCount >= 4 && state !== "success";

  async function saveLead(lead: LeadPayload) {
    try {
      setState("submitting");
      await submitLead(config, sessionId, lead);
      setState("success");
      await track("lead_submitted", { email: lead.email });
    } catch {
      setState("error");
    }
  }

  return {
    leadState: state,
    shouldShowLeadForm,
    saveLead,
  };
}
