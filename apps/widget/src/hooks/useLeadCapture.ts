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
  const [isModalOpen, setIsModalOpen] = useState(false);

  const shouldOfferLeadCapture =
    config.leadCaptureEnabled && messageCount >= 4;

  async function openLeadCapture() {
    setIsModalOpen(true);
    await track("lead_modal_opened");
  }

  function closeLeadCapture() {
    setIsModalOpen(false);
  }

  async function saveLead(lead: LeadPayload) {
    try {
      setState("submitting");
      await submitLead(config, sessionId, lead);
      setState("success");
      setIsModalOpen(false);
      await track("lead_submitted", { email: lead.email });
    } catch {
      setState("error");
    }
  }

  return {
    leadState: state,
    shouldOfferLeadCapture,
    isModalOpen,
    openLeadCapture,
    closeLeadCapture,
    saveLead,
  };
}
