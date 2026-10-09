import { CustomerStatusBadge } from "../CustomerStatusBadge";
import type { CustomerStatusTone } from "../customer-status";

type SetupStepStatusBadgeProps = {
  status?: CustomerStatusTone;
  label?: string;
};

function normalizeStatusLabel(label?: string) {
  if (!label) {
    return "Nicht begonnen";
  }

  const normalized = label
    .replace(/Abgeschlossen/g, "Bereit")
    .replace(/Offen/g, "Nicht begonnen")
    .replace(/Fehler/g, "Unvollständig");

  return normalized || "Nicht begonnen";
}

export function SetupStepStatusBadge({ status = "pending", label }: SetupStepStatusBadgeProps) {
  return <CustomerStatusBadge status={status} label={normalizeStatusLabel(label)} />;
}
