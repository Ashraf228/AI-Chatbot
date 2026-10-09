import { useState } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import type { LeadPayload, LeadSubmissionState } from "../../types/lead";

type LeadCaptureFormProps = {
  state: LeadSubmissionState;
  privacyUrl?: string;
  onSubmit: (lead: LeadPayload) => void | Promise<void>;
};

export function LeadCaptureForm({ state, privacyUrl, onSubmit }: LeadCaptureFormProps) {
  const [lead, setLead] = useState<LeadPayload>({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  function updateField(field: keyof LeadPayload, value: string) {
    setLead((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="ssb-lead-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(lead);
      }}
    >
      <div>
        <h2 id="ssb-lead-modal-title" className="ssb-lead-form__title">Kontakt aufnehmen</h2>
        <p id="ssb-lead-modal-description" className="ssb-lead-form__hint">
          Geben Sie nur die Kontaktdaten an, die für die Bearbeitung Ihrer Anfrage nötig sind.
        </p>
      </div>
      <label className="ssb-label" htmlFor="ssb-lead-name">Name</label>
      <Input
        id="ssb-lead-name"
        value={lead.name}
        placeholder="Name"
        autoComplete="name"
        onChange={(event) => updateField("name", event.target.value)}
      />
      <label className="ssb-label" htmlFor="ssb-lead-email">E-Mail</label>
      <Input
        id="ssb-lead-email"
        value={lead.email}
        type="email"
        placeholder="E-Mail"
        autoComplete="email"
        onChange={(event) => updateField("email", event.target.value)}
      />
      <label className="ssb-label" htmlFor="ssb-lead-phone">Telefon optional</label>
      <Input
        id="ssb-lead-phone"
        value={lead.phone}
        type="tel"
        placeholder="Telefon (optional)"
        autoComplete="tel"
        onChange={(event) => updateField("phone", event.target.value)}
      />
      <label className="ssb-label" htmlFor="ssb-lead-message">Anliegen oder Rückrufwunsch optional</label>
      <Input
        id="ssb-lead-message"
        value={lead.message || ""}
        placeholder="Anliegen oder Rückrufwunsch (optional)"
        onChange={(event) => updateField("message", event.target.value)}
      />
      {state === "error" ? (
        <div className="ssb-lead-form__error" role="alert">Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.</div>
      ) : null}
      <Button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Wird gesendet ..." : "Anfrage senden"}
      </Button>
      <p className="ssb-lead-form__privacy">
        Ihre Angaben werden zur Bearbeitung Ihrer Anfrage gespeichert, verarbeitet und bei Bedarf an den Websitebetreiber weitergeleitet. Bitte geben Sie keine Passwörter, Zahlungsdaten oder Ausweisdaten ein.
        {privacyUrl ? (
          <>
            {" "}
            <a href={privacyUrl} target="_blank" rel="noopener noreferrer">
              Datenschutzerklärung öffnen
            </a>
          </>
        ) : null}
      </p>
    </form>
  );
}
