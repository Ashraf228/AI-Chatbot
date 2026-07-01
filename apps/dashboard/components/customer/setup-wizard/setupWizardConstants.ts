import type { FallbackBehavior, KnowledgeMode, PrimaryGoal, Tone, WizardStep, WizardStepKey } from "./setupWizardTypes";

export const DEFAULT_PRIMARY_GOAL: PrimaryGoal = "lead_generation";
export const DEFAULT_TONE: Tone = "professional";
export const DEFAULT_BOT_TYPE = "universal-assistant";
export const DEFAULT_ENABLED_TASKS = ["answer_questions", "collect_requests", "support", "prepare_handoff"];

export const WIZARD_STEPS: WizardStep[] = [
  { key: "customer", label: "Kundendaten", description: "Firma, Website, erlaubte Website und Sprache" },
  { key: "bot", label: "KI-Mitarbeiter", description: "Ziel, Rolle und Antwortverhalten festlegen" },
  { key: "delivery", label: "Anfrage-Zustellung", description: "Anfrage-Erfassung und Empfänger-E-Mail" },
  { key: "flow", label: "Gesprächslogik", description: "Antworten, Rückfragen, Übergabe und Pflichtinformationen" },
  { key: "knowledge", label: "Wissen", description: "PDF, Website, FAQ oder eigene Texte" },
  { key: "design", label: "Design & Datenschutz", description: "Button, Begrüßung, Farbe und Datenschutzhinweis" },
  { key: "launch", label: "Test & Livegang", description: "Testfragen, Einbau-Code und Freigabe" },
];

export const GOAL_OPTIONS: Array<{ value: PrimaryGoal | ""; label: string; help: string }> = [
  { value: "", label: "Bitte wählen", help: "Noch kein Ziel gewählt." },
  { value: "support_automation", label: "Support automatisieren", help: "Häufige Kundenfragen zuverlässig beantworten." },
  { value: "lead_generation", label: "Anfragen gewinnen", help: "Interessenten erkennen und Kontaktdaten erfassen." },
  { value: "customer_advice", label: "Kunden beraten", help: "Besucher durch Beratungsgespräche führen." },
  { value: "product_questions", label: "Produktfragen beantworten", help: "Sortiment, Leistungen oder Produkte erklären." },
  { value: "appointment_requests", label: "Termine vorbereiten", help: "Kontakt- oder Terminwünsche qualifizieren." },
  { value: "internal_knowledge", label: "Internes Wissen nutzbar machen", help: "Wissen strukturiert und kontrolliert abrufen." },
];

export const PRIMARY_GOAL_VALUES = new Set<string>(GOAL_OPTIONS.map((option) => option.value).filter(Boolean));

export const TONE_OPTIONS: Array<{ value: Tone | ""; label: string }> = [
  { value: "", label: "Bitte wählen" },
  { value: "professional", label: "Professionell" },
  { value: "friendly", label: "Freundlich" },
  { value: "premium", label: "Premium" },
  { value: "direct", label: "Direkt" },
  { value: "consultative", label: "Beratend" },
];

export const KNOWLEDGE_MODE_OPTIONS: Array<{ value: KnowledgeMode; label: string; help: string }> = [
  { value: "flexible", label: "Flexibel", help: "Antwortet frei und nutzt die Wissensbasis, wenn sie passt." },
  { value: "grounded", label: "Mit Wissensbasis", help: "Antwortet vorrangig mit hinterlegten Kundeninformationen." },
  { value: "strict", label: "Nur mit Wissensbasis", help: "Antwortet nur, wenn passende Kundeninformationen vorhanden sind." },
];

export const FALLBACK_OPTIONS: Array<{ value: FallbackBehavior; label: string }> = [
  { value: "ask_followup", label: "Rückfrage stellen" },
  { value: "collect_contact", label: "Kontakt aufnehmen lassen" },
  { value: "handoff", label: "An Menschen übergeben" },
];

export const STATUS_STEP_GROUPS: Record<WizardStepKey, string[]> = {
  customer: ["basics"],
  bot: ["template", "behavior"],
  delivery: ["lead_delivery"],
  flow: ["behavior"],
  knowledge: ["knowledge"],
  design: ["design"],
  launch: ["test", "embed", "live"],
};

export const STEP_EXPLANATIONS: Record<WizardStepKey, string> = {
  customer: "Diese Angaben reichen, um den Kunden eindeutig anzulegen und die Website freizugeben.",
  bot: "Der Standard ist ein universeller KI-Mitarbeiter. Legacy-Branchenprofile bleiben nur für Alt-Konfigurationen verfügbar.",
  delivery: "Anfragen werden zuerst gespeichert und danach per E-Mail an das Unternehmen zugestellt.",
  flow: "Der Standardablauf bleibt bewusst fachlich und blendet technische Regeln im normalen Setup aus.",
  knowledge: "Die Wissensbasis sorgt dafür, dass Antworten verlässlich und kundenspezifisch bleiben.",
  design: "Ein passendes Design, Datenschutzlink und Datenschutzhinweis schaffen Vertrauen auf der Kundenwebsite.",
  launch: "Zum Schluss werden Testfragen, Einbau-Code, Website und Live-Status geprüft.",
};
