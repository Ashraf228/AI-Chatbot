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
        <div className="ssb-lead-form__title">Kontakt aufnehmen</div>
        <p className="ssb-lead-form__hint">
          Geben Sie nur die Kontaktdaten an, die für die Bearbeitung Ihrer Anfrage nötig sind.
        </p>
      </div>
      <Input
        value={lead.name}
        placeholder="Name"
        onChange={(event) => updateField("name", event.target.value)}
      />
      <Input
        value={lead.email}
        placeholder="E-Mail"
        onChange={(event) => updateField("email", event.target.value)}
      />
      <Input
        value={lead.phone}
        placeholder="Telefon (optional)"
        onChange={(event) => updateField("phone", event.target.value)}
      />
      <Input
        value={lead.message || ""}
        placeholder="Anliegen oder Rückrufwunsch (optional)"
        onChange={(event) => updateField("message", event.target.value)}
      />
      {state === "error" ? (
        <div className="ssb-lead-form__error">Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.</div>
      ) : null}
      <Button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Wird gesendet ..." : "Anfrage senden"}
      </Button>
      <p className="ssb-lead-form__privacy">
        Ihre Angaben werden zur Bearbeitung Ihrer Anfrage gespeichert, verarbeitet und bei Bedarf an den Websitebetreiber weitergeleitet. Bitte geben Sie keine Passwörter, Zahlungsdaten oder Ausweisdaten ein.
        {privacyUrl ? (
          <>
            {" "}
            <a href={privacyUrl} target="_blank" rel="noreferrer">
              Datenschutzerklärung öffnen
            </a>
          </>
        ) : null}
      </p>
    </form>
  );
}
