import Link from "next/link";
import { CompactMetricCard } from "../../shared/CompactMetricCard";
import type { CustomerStatusTone } from "../customer-status";
import { SetupAdvancedDetails } from "./SetupAdvancedDetails";
import { SetupStepHeader } from "./SetupStepHeader";

type ConversationFlowStepProps = {
  siteSlug: string;
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

const REQUIRED_INFORMATION_OPTIONS = [
  "Name",
  "E-Mail",
  "Telefon",
  "Anliegen",
  "Produkt / Thema",
  "Kundennummer",
  "Priorität",
  "gewünschter Rückruf oder Termin",
  "individuelle Pflichtinformation",
];

const CONVERSATION_GOALS = [
  "Fragen beantworten",
  "Supportfall vorbereiten",
  "Kundenanfrage aufnehmen",
  "Produkt-/Leistungsberatung",
  "Termin oder Rückruf vorbereiten",
  "Übergabe an Team",
  "Ticket vorbereiten",
  "Daten an angebundene Systeme übergeben",
];

export function ConversationFlowStep({ siteSlug, explanation, status, statusLabel }: ConversationFlowStepProps) {
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
            {REQUIRED_INFORMATION_OPTIONS.map((item) => (
              <span key={item} className="dashboard-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <strong>Welche Gesprächsziele kann der KI-Mitarbeiter verfolgen?</strong>
          <div className="dashboard-chip-row" aria-label="Universelle Gesprächsziele">
            {CONVERSATION_GOALS.map((item) => (
              <span key={item} className="dashboard-chip">
                {item}
              </span>
            ))}
          </div>
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
