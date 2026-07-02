import { Input } from "../../shared/Input";
import { Select } from "../../shared/Select";
import type { CustomerStatusTone } from "../customer-status";
import { SetupStepHeader } from "./SetupStepHeader";
import type { CustomerProfileForm } from "./setupWizardTypes";

type CustomerDataStepProps = {
  value: CustomerProfileForm;
  onChange: (value: CustomerProfileForm) => void;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
};

export function CustomerDataStep({ value, onChange, explanation, status, statusLabel }: CustomerDataStepProps) {
  return (
    <section className="dashboard-card dashboard-stack" id="setup-step-basics">
      <SetupStepHeader
        title="Kundendaten"
        description="Lege Kundenname, Hauptdomain und Standardsprache fest."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <div className="dashboard-grid dashboard-grid--two">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Firmenname (Pflicht)</span>
          <Input
            value={value.companyName}
            onChange={(event) => onChange({ ...value, companyName: event.target.value })}
            placeholder="Muster GmbH"
          />
          <span className="dashboard-field-hint">Dieser Name erscheint intern und hilft bei der Zuordnung.</span>
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Website (Pflicht)</span>
          <Input
            value={value.websiteUrl}
            onChange={(event) => onChange({ ...value, websiteUrl: event.target.value })}
            placeholder="https://www.kunde.de"
          />
          <span className="dashboard-field-hint">Die Website wird für Freigabe und Einbindung genutzt.</span>
        </label>
      </div>
      <label className="dashboard-field">
        <span className="dashboard-field-label">Erlaubte Websites (Pflicht)</span>
        <textarea
          className="dashboard-textarea"
          rows={3}
          value={value.allowedDomains}
          onChange={(event) => onChange({ ...value, allowedDomains: event.target.value })}
          placeholder="kunde.de&#10;www.kunde.de"
        />
        <span className="dashboard-field-hint">Domains, auf denen dieses Widget eingebunden werden darf.</span>
      </label>
      <div className="dashboard-grid dashboard-grid--two">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Sprache des KI-Mitarbeiters (Pflicht)</span>
          <Select
            aria-label="Sprache des KI-Mitarbeiters"
            value={value.language}
            onChange={(event) => onChange({ ...value, language: event.target.value === "en" ? "en" : "de" })}
          >
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </Select>
          <span className="dashboard-field-hint">Die Sprache, in der der KI-Mitarbeiter standardmäßig antwortet.</span>
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Telefonnummer des Unternehmens (optional)</span>
          <Input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} placeholder="+49 ..." />
        </label>
      </div>
      <label className="dashboard-field">
        <span className="dashboard-field-label">Support-E-Mail (optional)</span>
        <Input
          type="email"
          value={value.supportEmail}
          onChange={(event) => onChange({ ...value, supportEmail: event.target.value })}
          placeholder="support@kunde.de"
        />
      </label>
    </section>
  );
}
