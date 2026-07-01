import Link from "next/link";
import { CompactMetricCard } from "../../shared/CompactMetricCard";
import type { CustomerStatusTone } from "../customer-status";
import { ENABLED_TASK_OPTIONS, REQUIRED_FIELD_OPTIONS } from "./setupWizardConstants";
import { SetupAdvancedDetails } from "./SetupAdvancedDetails";
import { SetupStepHeader } from "./SetupStepHeader";
import type { ConversationFlowForm } from "./setupWizardTypes";

type ConversationFlowStepProps = {
  siteSlug: string;
  value: ConversationFlowForm;
  onChange: (value: ConversationFlowForm) => void;
  explanation?: string;
  status: CustomerStatusTone;
  statusLabel?: string;
};

const CONVERSATION_FLOW_STEPS = [
  "Anliegen verstehen",
  "Wissensantwort prüfen",
  "Rückfrage stellen",
  "Pflichtinformationen sammeln",
  "Übergabe vorbereiten",
  "Zusammenfassung erstellen",
];

function toggleItem(items: string[], item: string) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}

export function ConversationFlowStep({
  siteSlug,
  value,
  onChange,
  explanation,
  status,
  statusLabel,
}: ConversationFlowStepProps) {
  const hasNoRequiredFields = value.requiredFields.length === 0;
  const hasNoEnabledTasks = value.enabledTasks.length === 0;

  return (
    <section className="dashboard-card dashboard-stack conversation-flow-step" id="setup-step-flow">
      <SetupStepHeader
        title="Gesprächslogik"
        description="Lege fest, wie der KI-Mitarbeiter Anliegen versteht, Antworten gibt, Rückfragen stellt und bei Bedarf an dein Team übergibt."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm conversation-flow-step__preview">
        <strong>Universeller Ablauf</strong>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Anliegen verstehen → Antwort aus Wissen prüfen → sinnvoll nachfragen → Informationen sammeln → Übergabe vorbereiten
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3 conversation-flow-step__grid">
        {CONVERSATION_FLOW_STEPS.map((item) => (
          <CompactMetricCard key={item} label="Schritt" value={item} />
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid--two conversation-flow-step__configuration">
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Welche Informationen soll die KI bei Bedarf sammeln?</strong>
          <div className="dashboard-chip-row" aria-label="Generische Pflichtinformationen">
            {REQUIRED_FIELD_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dashboard-chip dashboard-chip--button${value.requiredFields.includes(item.key) ? " dashboard-chip--selected" : ""}`}
                aria-pressed={value.requiredFields.includes(item.key)}
                onClick={() =>
                  onChange({
                    ...value,
                    requiredFields: toggleItem(value.requiredFields, item.key),
                  })
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          {hasNoRequiredFields ? (
            <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
              Die KI kann ohne Pflichtinformationen antworten, aber keine strukturierte Übergabe vorbereiten.
            </p>
          ) : null}
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Welche Gesprächsziele kann der KI-Mitarbeiter verfolgen?</strong>
          <div className="dashboard-chip-row" aria-label="Universelle Gesprächsziele">
            {ENABLED_TASK_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dashboard-chip dashboard-chip--button${value.enabledTasks.includes(item.key) ? " dashboard-chip--selected" : ""}`}
                aria-pressed={value.enabledTasks.includes(item.key)}
                onClick={() =>
                  onChange({
                    ...value,
                    enabledTasks: toggleItem(value.enabledTasks, item.key),
                  })
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          {hasNoEnabledTasks ? (
            <p className="dashboard-copy dashboard-copy--warning dashboard-no-margin-bottom" role="status">
              Wähle mindestens ein Gesprächsziel oder erledige den Schritt später.
            </p>
          ) : null}
        </div>
      </div>

      <SetupAdvancedDetails title="Erweitert: Legacy-Gesprächsabläufe" className="conversation-flow-step__advanced">
        <p className="dashboard-copy dashboard-copy--muted">
          Diese Vorlagen sind nur für bestehende Alt-Konfigurationen gedacht. Neue KI-Mitarbeiter nutzen die universelle Gesprächslogik.
        </p>
        <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
          Erweiterte Chatfenster-Einstellungen öffnen
        </Link>
      </SetupAdvancedDetails>
    </section>
  );
}
