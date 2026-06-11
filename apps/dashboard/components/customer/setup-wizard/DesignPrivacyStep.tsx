import { WidgetPreview } from "../../branding/WidgetPreview";
import { Button } from "../../shared/Button";
import { Input } from "../../shared/Input";
import { Select } from "../../shared/Select";
import type { CustomerStatusTone } from "../customer-status";
import type { DesignPrivacyForm, SiteDetails } from "./setupWizardTypes";
import { SetupAdvancedDetails } from "./SetupAdvancedDetails";
import { SetupStepHeader } from "./SetupStepHeader";

type DesignPrivacyStepProps = {
  value: DesignPrivacyForm;
  onChange: (value: DesignPrivacyForm) => void;
  site: Pick<SiteDetails, "companyName" | "name" | "botName" | "fontFamily">;
  profileCompanyName: string;
  onSave: () => void;
  isSaving?: boolean;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
};

export function DesignPrivacyStep({
  value,
  onChange,
  site,
  profileCompanyName,
  onSave,
  isSaving = false,
  explanation,
  status,
  statusLabel,
}: DesignPrivacyStepProps) {
  return (
    <section className="dashboard-card dashboard-stack" id="setup-step-design">
      <SetupStepHeader
        title="Design anpassen"
        description="Passe Farben, Button, Position und Logo an die Kundenwebsite an."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <div className="dashboard-grid dashboard-grid--form-preview">
        <div className="dashboard-stack">
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Text im Eingabefeld (optional)</span>
              <Input value={value.placeholderText} onChange={(event) => onChange({ ...value, placeholderText: event.target.value })} />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Button-Text (optional)</span>
              <Input value={value.launcherLabel} onChange={(event) => onChange({ ...value, launcherLabel: event.target.value })} />
            </label>
          </div>
          <div className="dashboard-grid dashboard-grid--two">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Hauptfarbe (Pflicht)</span>
              <Input type="color" value={value.brandColor} onChange={(event) => onChange({ ...value, brandColor: event.target.value })} />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Position (Pflicht)</span>
              <Select
                value={value.widgetPosition}
                onChange={(event) =>
                  onChange({ ...value, widgetPosition: event.target.value === "bottom_left" ? "bottom_left" : "bottom_right" })
                }
              >
                <option value="bottom_right">Unten rechts</option>
                <option value="bottom_left">Unten links</option>
              </Select>
            </label>
          </div>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Datenschutzlink (Pflicht)</span>
            <Input
              value={value.privacyUrl}
              onChange={(event) => onChange({ ...value, privacyUrl: event.target.value })}
              placeholder="https://www.kunde.de/datenschutz"
            />
          </label>
          <label className="dashboard-checkbox">
            <input
              type="checkbox"
              checked={value.consentRequired}
              onChange={(event) => onChange({ ...value, consentRequired: event.target.checked })}
            />
            <span>Datenschutzhinweis aktiv</span>
          </label>
          <SetupAdvancedDetails title="Optionale Designfelder" className="dashboard-card dashboard-card--soft">
            <label className="dashboard-field">
              <span className="dashboard-field-label">Logo-URL (optional)</span>
              <Input value={value.logoUrl} onChange={(event) => onChange({ ...value, logoUrl: event.target.value })} placeholder="https://..." />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Akzentfarbe (optional)</span>
              <Input type="color" value={value.accentColor} onChange={(event) => onChange({ ...value, accentColor: event.target.value })} />
            </label>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Datenschutz-Hinweis (optional)</span>
              <textarea
                className="dashboard-textarea"
                rows={3}
                value={value.privacyNoticeText}
                onChange={(event) => onChange({ ...value, privacyNoticeText: event.target.value })}
                placeholder="Kurzer Hinweis zur Verarbeitung von Chatdaten."
              />
            </label>
          </SetupAdvancedDetails>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Speichert..." : "Design speichern & Vorschau prüfen"}
          </Button>
        </div>
        <WidgetPreview
          companyName={profileCompanyName || site.companyName || site.name}
          botName={site.botName}
          logoUrl={value.logoUrl}
          brandColor={value.brandColor}
          accentColor={value.accentColor}
          fontFamily={site.fontFamily}
          welcomeMessage={value.welcomeMessage}
          placeholderText={value.placeholderText}
          launcherLabel={value.launcherLabel}
          privacyUrl={value.privacyUrl}
        />
      </div>
    </section>
  );
}
