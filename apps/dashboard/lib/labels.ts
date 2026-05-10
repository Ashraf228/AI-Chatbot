export type LabelTone = "success" | "warning" | "error" | "neutral" | "attention";

const STATUS_LABELS: Record<string, string> = {
  ready: "Bereit",
  processing: "Wird verarbeitet",
  pending: "Wartet",
  failed: "Fehler",
  disabled: "Deaktiviert",
  enabled: "Aktiv",
  live: "Live",
  draft: "Entwurf",
  setup_incomplete: "Setup offen",
  ready_for_test: "Test bereit",
  ready_for_live: "Bereit für Go-Live",
  paused: "Pausiert",
  error: "Fehler",
  unknown: "Unbekannt",
  new: "Neu",
  open: "Offen",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  closed: "Abgeschlossen",
  answered: "Beantwortet",
  unanswered: "Unbeantwortet",
  handoff: "Übergabe nötig",
  ticket: "Ticket erstellt",
  lead: "Anfrage erkannt",
  contact_requested: "Kontakt angefragt",
};

const DECISION_LABELS: Record<string, string> = {
  answer: "Antwort",
  ask_followup: "Rückfrage",
  capture_lead: "Anfrage erkannt",
  schedule_contact: "Kontakt angefragt",
  create_ticket: "Ticket erstellt",
  recommend_service: "Empfehlung",
  handoff: "Übergabe nötig",
  trigger_tool: "Aktion gestartet",
};

const KNOWLEDGE_MODE_LABELS: Record<string, string> = {
  flexible: "Flexibel",
  grounded: "Quellenbasiert",
  strict: "Strikt",
};

const TOOL_LABELS: Record<string, string> = {
  capture_lead: "Anfrage speichern",
  schedule_contact: "Kontakt vorbereiten",
  create_ticket: "Ticket erstellen",
  push_webhook: "Webhook senden",
  query_knowledge: "Wissen abfragen",
  recommend_service: "Leistung empfehlen",
  handoff: "Übergabe markieren",
};

export function humanizeLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function getStatusLabel(value: string | null | undefined) {
  if (!value) return "";
  return STATUS_LABELS[value] || humanizeLabel(value);
}

export function getStatusTone(value: string | null | undefined): LabelTone {
  if (!value) return "neutral";
  if (["ready", "enabled", "live", "closed", "answered", "qualified"].includes(value)) return "success";
  if (["processing", "pending", "draft", "setup_incomplete", "ready_for_test", "ready_for_live", "new", "open", "contacted"].includes(value)) return "warning";
  if (["failed", "error", "disabled"].includes(value)) return "error";
  if (["unanswered", "handoff", "ticket", "lead", "contact_requested"].includes(value)) return "attention";
  return "neutral";
}

export function getDecisionLabel(value: string | null | undefined) {
  if (!value) return "";
  return DECISION_LABELS[value] || humanizeLabel(value);
}

export function getKnowledgeModeLabel(value: string | null | undefined) {
  if (!value) return "";
  return KNOWLEDGE_MODE_LABELS[value] || humanizeLabel(value);
}

export function getToolLabel(value: string | null | undefined) {
  if (!value) return "";
  return TOOL_LABELS[value] || humanizeLabel(value);
}
