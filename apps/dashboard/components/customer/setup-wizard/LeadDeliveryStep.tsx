import { Input } from "../../shared/Input";
import type { CustomerStatusTone } from "../customer-status";
import type { LeadDeliveryForm } from "./setupWizardTypes";
import { SetupStepHeader } from "./SetupStepHeader";

type LeadDeliveryStepProps = {
  value: LeadDeliveryForm;
  onChange: (value: LeadDeliveryForm) => void;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
};

export function LeadDeliveryStep({ value, onChange, explanation, status, statusLabel }: LeadDeliveryStepProps) {
  return (
    <section className="dashboard-card dashboard-stack" id="setup-step-delivery">
      <SetupStepHeader
        title="Anfrage-Zustellung"
        description="Anfragen werden zuerst gespeichert und danach per E-Mail zugestellt."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <label className="dashboard-checkbox">
        <input
          type="checkbox"
          checked={value.leadCaptureEnabled}
          onChange={(event) => onChange({ ...value, leadCaptureEnabled: event.target.checked })}
        />
        <span>Anfrage-Erfassung aktiv</span>
      </label>
      <label className="dashboard-field">
        <span className="dashboard-field-label">Empfänger für neue Anfragen</span>
        <Input
          type="email"
          value={value.leadNotificationEmail}
          onChange={(event) => onChange({ ...value, leadNotificationEmail: event.target.value })}
          placeholder="info@unternehmen.de"
        />
        <span className="dashboard-field-hint">
          An diese Adresse werden neue Kundenanfragen aus dem Chat gesendet. Das ist nicht die E-Mail des Besuchers.
        </span>
      </label>
      <p className={value.leadNotificationEmail ? "dashboard-status dashboard-status--success" : "dashboard-status dashboard-status--warning"}>
        {value.leadNotificationEmail ? "E-Mail eingerichtet" : "E-Mail fehlt"}
      </p>
    </section>
  );
}
