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
      <div className="ssb-lead-form__title">Rueckruf oder Angebot anfragen</div>
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
        <div className="ssb-lead-form__error">Lead konnte nicht gespeichert werden.</div>
      ) : null}
      <Button type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Wird gesendet ..." : "Kontakt anfragen"}
      </Button>
    </form>
  );
}
