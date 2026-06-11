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
  "Problem erfassen",
  "Dringlichkeit erfassen",
  "vollständige Einsatzadresse erfassen",
  "Vor- und Nachname erfragen",
  "Telefonnummer erfragen",
  "Anfrage speichern und zustellen",
];

export function ConversationFlowStep({ siteSlug, explanation, status, statusLabel }: ConversationFlowStepProps) {
  return (
    <section className="dashboard-card dashboard-stack conversation-flow-step" id="setup-step-flow">
      <SetupStepHeader
        title="Gesprächsablauf"
        description="Standardflow für Handwerker und lokale Dienstleister."
        explanation={explanation}
        status={status}
        statusLabel={statusLabel}
      />

      <div className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm conversation-flow-step__preview">
        <strong>Handwerker-Erstkontakt</strong>
        <p className="dashboard-copy dashboard-copy--muted dashboard-no-margin-bottom">
          Problem → Dringlichkeit → vollständige Einsatzadresse → Vor- und Nachname → Telefonnummer → E-Mail an Unternehmen
        </p>
      </div>

      <div className="dashboard-grid dashboard-grid--metrics-3 conversation-flow-step__grid">
        {CONVERSATION_FLOW_STEPS.map((item) => (
          <CompactMetricCard key={item} label="Schritt" value={item} />
        ))}
      </div>

      <SetupAdvancedDetails title="Erweitert" className="conversation-flow-step__advanced">
        <p className="dashboard-copy dashboard-copy--muted">
          Triggerwörter, Ablauf-IDs und der Editor für Gesprächslogik bleiben verfügbar, sind aber nicht Teil der normalen Einrichtung.
        </p>
        <Link href={`/sites/${siteSlug}/widget`} className="dashboard-button dashboard-button--secondary">
          Erweiterte Chatfenster-Einstellungen öffnen
        </Link>
      </SetupAdvancedDetails>
    </section>
  );
}
