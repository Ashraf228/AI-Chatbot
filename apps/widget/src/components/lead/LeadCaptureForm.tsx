import { useState } from "react";
import { Button } from "../shared/Button";
import { Input } from "../shared/Input";
import type { LeadPayload, LeadSubmissionState } from "../../types/lead";

type LeadCaptureFormProps = {
  state: LeadSubmissionState;
  onSubmit: (lead: LeadPayload) => void | Promise<void>;
};

export function LeadCaptureForm({ state, onSubmit }: LeadCaptureFormProps) {
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
          Hinterlasse kurz deine Daten. Wir melden uns mit einer passenden Antwort zurück.
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
        placeholder="Worum geht es? (optional)"
        onChange={(event) => updateField("message", event.target.value)}
      />
      {state === "error" ? (
        <div className="ssb-lead-form__error">Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.</div>
      ) : null}
      <Button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Wird gesendet ..." : "Anfrage senden"}
      </Button>
      <p className="ssb-lead-form__privacy">
        Wir verwenden deine Angaben nur zur Bearbeitung deiner Anfrage.
      </p>
    </form>
  );
}
