import type { LeadPayload, LeadSubmissionState } from "../../types/lead";
import { LeadCaptureForm } from "./LeadCaptureForm";

type LeadCaptureModalProps = {
  open: boolean;
  state: LeadSubmissionState;
  privacyUrl?: string;
  onClose: () => void;
  onSubmit: (lead: LeadPayload) => void | Promise<void>;
};

export function LeadCaptureModal({
  open,
  state,
  privacyUrl,
  onClose,
  onSubmit,
}: LeadCaptureModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="ssb-modal" role="dialog" aria-modal="true" aria-label="Kontaktdaten hinterlassen">
      <button
        type="button"
        className="ssb-modal__backdrop"
        aria-label="Modal schließen"
        onClick={onClose}
      />
      <div className="ssb-modal__panel">
        <button type="button" className="ssb-modal__close" aria-label="Schließen" onClick={onClose}>
          ×
        </button>
        <LeadCaptureForm state={state} privacyUrl={privacyUrl} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
