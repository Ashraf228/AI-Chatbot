import { useEffect, useRef } from "react";
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const focusFirst = () => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstFocusable?.focus();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.setTimeout(focusFirst, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="ssb-modal" role="dialog" aria-modal="true" aria-labelledby="ssb-lead-modal-title" aria-describedby="ssb-lead-modal-description">
      <button
        type="button"
        className="ssb-modal__backdrop"
        aria-label="Modal schließen"
        onClick={onClose}
      />
      <div ref={panelRef} className="ssb-modal__panel">
        <button type="button" className="ssb-modal__close" aria-label="Schließen" onClick={onClose}>
          ×
        </button>
        <LeadCaptureForm state={state} privacyUrl={privacyUrl} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
