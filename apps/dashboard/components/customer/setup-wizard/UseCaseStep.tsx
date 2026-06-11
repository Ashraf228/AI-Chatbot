import type { IndustryTemplate } from "../../../lib/industry-templates";
import { Button } from "../../shared/Button";
import { Input } from "../../shared/Input";
import { Select } from "../../shared/Select";
import type { CustomerStatusTone } from "../customer-status";
import {
  FALLBACK_OPTIONS,
  GOAL_OPTIONS,
  KNOWLEDGE_MODE_OPTIONS,
  TONE_OPTIONS,
} from "./setupWizardConstants";
import { formatDate } from "./setupWizardFormatters";
import type { CustomerProfileForm, FallbackBehavior, KnowledgeMode, SetupGoalForm, SiteDetails } from "./setupWizardTypes";
import { SetupAdvancedDetails } from "./SetupAdvancedDetails";
import { SetupStepHeader } from "./SetupStepHeader";

type UseCaseStepProps = {
  profileValue: CustomerProfileForm;
  onProfileChange: (value: CustomerProfileForm) => void;
  goalValue: SetupGoalForm;
  onGoalChange: (value: SetupGoalForm) => void;
  templates: IndustryTemplate[];
  selectedTemplate?: IndustryTemplate;
  templateAppliedAt?: string;
  hasTemplateApplied?: boolean;
  onApplyTemplate: () => void;
  isApplyingTemplate?: boolean;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
};

export function UseCaseStep({
  profileValue,
  onProfileChange,
  goalValue,
  onGoalChange,
  templates,
  selectedTemplate,
  templateAppliedAt,
  hasTemplateApplied = false,
  onApplyTemplate,
  isApplyingTemplate = false,
  explanation,
  status,
  statusLabel,
}: UseCaseStepProps) {
  return (
    <section className="dashboard-card dashboard-stack" id="setup-step-industry">
      <SetupStepHeader
        title="Anwendungsfall"
        description="Wähle das Branchenpaket und den Anwendungsfall für den ersten Einsatz."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />
      <div className="dashboard-grid dashboard-grid--two">
        <label className="dashboard-field">
          <span className="dashboard-field-label">Branche (Pflicht)</span>
          <Select value={profileValue.industry} onChange={(event) => onProfileChange({ ...profileValue, industry: event.target.value })}>
            <option value="">Bitte wählen</option>
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Anwendungsfall</span>
          <Select value={goalValue.botType} onChange={(event) => onGoalChange({ ...goalValue, botType: event.target.value })}>
            <option value="handwerker-first-contact">Handwerker-Erstkontakt</option>
          </Select>
          <span className="dashboard-field-hint">
            Erfasst Problem, Einsatzadresse, Dringlichkeit und Kontaktdaten und sendet die Anfrage per E-Mail.
          </span>
        </label>
      </div>
      <div className="setup-template-panel">
        <strong>{selectedTemplate?.label || "Noch keine Vorlage ausgewählt"}</strong>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          {selectedTemplate?.description ||
            (hasTemplateApplied
              ? `Vorlage angewendet am ${formatDate(templateAppliedAt)}`
              : "Die Vorlage setzt formelle Texte, den Standardablauf und passende Funktionen.")}
        </p>
        <Button type="button" variant="secondary" onClick={onApplyTemplate} disabled={isApplyingTemplate || !profileValue.industry}>
          {isApplyingTemplate ? "Wendet an..." : "Vorlage anwenden"}
        </Button>
      </div>
      <SetupAdvancedDetails title="Erweitert: Ziel und Ton">
        <div className="dashboard-grid dashboard-grid--two">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Ziel des Chatfensters</span>
            <Select
              value={goalValue.primaryGoal}
              onChange={(event) => onGoalChange({ ...goalValue, primaryGoal: event.target.value as SiteDetails["primaryGoal"] })}
            >
              {GOAL_OPTIONS.map((option) => (
                <option key={option.value || "empty"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Tonalität</span>
            <Select value={goalValue.tone} onChange={(event) => onGoalChange({ ...goalValue, tone: event.target.value as SiteDetails["tone"] })}>
              {TONE_OPTIONS.map((option) => (
                <option key={option.value || "empty"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="dashboard-grid dashboard-grid--two">
          <label className="dashboard-field">
            <span className="dashboard-field-label">Antwortverhalten mit Wissen</span>
            <Select
              value={goalValue.knowledgeMode}
              onChange={(event) => onGoalChange({ ...goalValue, knowledgeMode: event.target.value as KnowledgeMode })}
            >
              {KNOWLEDGE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="dashboard-field">
            <span className="dashboard-field-label">Wenn der Assistent unsicher ist</span>
            <Select
              value={goalValue.fallbackBehavior}
              onChange={(event) => onGoalChange({ ...goalValue, fallbackBehavior: event.target.value as FallbackBehavior })}
            >
              {FALLBACK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Nächster Schritt für Besucher</span>
          <Input value={goalValue.ctaText} onChange={(event) => onGoalChange({ ...goalValue, ctaText: event.target.value })} placeholder="Anfrage aufnehmen" />
        </label>
        <label className="dashboard-field">
          <span className="dashboard-field-label">Interne Gesprächsregel</span>
          <textarea
            className="dashboard-textarea"
            rows={4}
            value={goalValue.systemPrompt}
            onChange={(event) => onGoalChange({ ...goalValue, systemPrompt: event.target.value })}
            placeholder="Optionales Verhalten des Assistenten für Sonderfälle."
          />
        </label>
      </SetupAdvancedDetails>
    </section>
  );
}
