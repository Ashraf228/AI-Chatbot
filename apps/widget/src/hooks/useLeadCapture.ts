import { useState } from "react";
import { submitLead } from "../services/leadService";
import type { LeadPayload, LeadSubmissionState } from "../types/lead";
import { useWidgetConfig } from "./useWidgetConfig";
import { useAnalytics } from "./useAnalytics";
import { useSessionContext } from "../app/providers/SessionProvider";
import type { LeadPayload as LeadPayloadType } from "../types/lead";

type UseLeadCaptureOptions = {
  onSuccess?: (lead: LeadPayloadType) => void | Promise<void>;
};

export function useLeadCapture(options?: UseLeadCaptureOptions) {
  const config = useWidgetConfig();
  const { track } = useAnalytics();
  const { consentAccepted, ensureSession } = useSessionContext();
  const [state, setState] = useState<LeadSubmissionState>("idle");
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function openLeadCapture() {
    if (config.consentRequired && !consentAccepted) {
      setState("error");
      return;
    }

    const session = await ensureSession();
    if (!session) {
      setState("error");
      return;
    }

    setIsModalOpen(true);
    await track("lead_modal_opened");
  }

  function closeLeadCapture() {
    setIsModalOpen(false);
  }

  async function saveLead(lead: LeadPayload) {
    try {
      setState("submitting");
      const session = await ensureSession();
      if (!session) {
        throw new Error("Session unavailable");
      }

      await submitLead(config, session.sessionId, lead);
      setState("success");
      setIsModalOpen(false);
      await options?.onSuccess?.(lead);
      await track("lead_submitted", { hasEmail: Boolean(lead.email) });
    } catch {
      setState("error");
    }
  }

  return {
    leadState: state,
    isModalOpen,
    openLeadCapture,
    closeLeadCapture,
    saveLead,
  };
}
