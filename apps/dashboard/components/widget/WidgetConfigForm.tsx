"use client";

import { useEffect, useState } from "react";
import { ConsentSettings } from "./ConsentSettings";
import { LeadFlowSettings } from "./LeadFlowSettings";
import { SuggestedQuestionsEditor } from "./SuggestedQuestionsEditor";
import { Button } from "../shared/Button";
import { ErrorState } from "../shared/ErrorState";
import { Input } from "../shared/Input";
import { LoadingState } from "../shared/LoadingState";
import { Select } from "../shared/Select";

type WidgetConfigFormProps = {
  siteId: string;
};

const FLOW_SIGNAL_OPTIONS = [
  { value: "contactIntent", label: "Kontaktwunsch erkannt" },
  { value: "qualifiedNeed", label: "Bedarf erkannt" },
  { value: "industry", label: "Branche / Kontext vorhanden" },
  { value: "urgency", label: "Dringlichkeit / Umfang vorhanden" },
  { value: "affirmedContactCta", label: "Zustimmung auf Kontakt-CTA" },
] as const;

type ConversationFlowSignal = (typeof FLOW_SIGNAL_OPTIONS)[number]["value"];
type PreviewMessage = { role: "assistant" | "user"; content: string };

const AFFIRMATION_PATTERN = /^(ja|jap|yes|bitte|gern|gerne|okay|ok|klingt gut|mach(en)? wir)\b/i;

type ConversationFlowStateForm = {
  id: string;
  label: string;
  instruction: string;
  preferredQuestion: string;
  requires: ConversationFlowSignal[];
  requiresAny: ConversationFlowSignal[];
  forbids: ConversationFlowSignal[];
  matchAny: string[];
};

type ConversationFlowForm = {
  questions: {
    opening: string;
    industry: string;
    urgency: string;
  };
  instructions: {
    clarify: string;
    qualifiedMissingIndustry: string;
    qualifiedMissingUrgency: string;
    qualifiedReady: string;
    contactReady: string;
  };
  triggers: {
    contactIntent: string[];
    qualifiedNeed: string[];
    industry: string[];
    urgency: string[];
  };
  states: ConversationFlowStateForm[];
};

type ConversationFlowPreset = {
  label: string;
  description: string;
  flow: Omit<ConversationFlowForm, "states"> & { states?: ConversationFlowStateForm[] };
};

const FLOW_PREVIEW_SCENARIOS: Array<{
  id: string;
  label: string;
  description: string;
  messages: PreviewMessage[];
}> = [
  {
    id: "opening",
    label: "Allgemeiner Einstieg",
    description: "Der Nutzer startet noch sehr offen. Hier sollte normalerweise der Clarify-Branch greifen.",
    messages: [
      { role: "assistant", content: "Hi! Wie kann ich helfen?" },
      { role: "user", content: "ich brauche eine ki" },
    ],
  },
  {
    id: "qualified",
    label: "Bedarf klar, Branche fehlt",
    description: "Der Use Case ist schon klarer, aber die Einordnung fehlt noch.",
    messages: [
      { role: "assistant", content: "Hi! Wie kann ich helfen?" },
      { role: "user", content: "ich möchte meinen support automatisieren" },
    ],
  },
  {
    id: "qualified-ready",
    label: "Fast kontaktbereit",
    description: "Bedarf, Branche und Dringlichkeit sind da. Jetzt sollte der Flow Richtung Kontakt gehen.",
    messages: [
      { role: "assistant", content: "Hi! Wie kann ich helfen?" },
      { role: "user", content: "wir wollen support-standardfragen in unserer agentur zeitnah automatisieren" },
    ],
  },
  {
    id: "contact-ready",
    label: "Kontaktbestätigung",
    description: "Der Nutzer bestätigt nach einer CTA. Hier sollte direkt der Kontakt-Branch greifen.",
    messages: [
      {
        role: "assistant",
        content: "Das klingt nach einem passenden Use Case. Möchtest du lieber einen Termin oder direkt eine Anfrage schicken?",
      },
      { role: "user", content: "ja bitte" },
    ],
  },
];

const DEFAULT_CONVERSATION_FLOW: ConversationFlowForm = {
  questions: {
    opening: "Geht es bei dir eher um Support, Prozesse, Marketing oder etwas anderes?",
    industry: "Für welches Unternehmen oder welche Branche ist das gedacht?",
    urgency: "Wie dringend oder wie groß ist das Thema aktuell bei euch?",
  },
  instructions: {
    clarify:
      "Wenn der Einstieg allgemein ist, stelle genau eine Qualifizierungsfrage und gehe noch nicht direkt auf Termin.",
    qualifiedMissingIndustry:
      "Wenn der Bedarf klar ist, aber die Branche fehlt, gib kurz eine Einordnung und frage gezielt nach der Branche.",
    qualifiedMissingUrgency:
      "Wenn der Bedarf klar ist, aber die Dringlichkeit fehlt, gib kurz eine Einordnung und frage gezielt nach Dringlichkeit oder Umfang.",
    qualifiedReady:
      "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite direkt in Richtung Kontakt oder Termin.",
    contactReady:
      "Wenn der Nutzer Kontakt möchte oder zustimmt, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
  },
  triggers: {
    contactIntent: ["kontakt", "anfrage", "angebot", "termin", "rueckruf"],
    qualifiedNeed: ["support", "kundenservice", "marketing", "prozesse", "automatisierung"],
    industry: ["unternehmen", "firma", "agentur", "shop", "kanzlei", "praxis"],
    urgency: ["sofort", "dringend", "zeitnah", "schnell"],
  },
  states: [],
};

const FLOW_PRESETS: Record<string, ConversationFlowPreset> = {
  leadQualification: {
    label: "Lead-Qualifizierung",
    description: "Für Erstgespräche, Bedarf verstehen und zügig Richtung Kontakt leiten.",
    flow: DEFAULT_CONVERSATION_FLOW,
  },
  support: {
    label: "Support",
    description: "Für Support-Anliegen mit Fokus auf Problem, Kontext und anschließende Weiterleitung.",
    flow: {
      questions: {
        opening: "Geht es bei dir eher um ein akutes Problem, eine Rückfrage zu einem Vorgang oder allgemeine Hilfe?",
        industry: "Geht es um einen bestimmten Kundenfall, ein Produkt oder einen internen Ablauf?",
        urgency: "Wie dringend ist das Thema gerade für dich?",
      },
      instructions: {
        clarify:
          "Wenn das Anliegen noch unklar ist, frage gezielt nach dem konkreten Supportfall und halte die Antwort ruhig und lösungsorientiert.",
        qualifiedMissingIndustry:
          "Wenn das Problem klar ist, aber der genaue Kontext fehlt, frage nach Produkt, Vorgang oder betroffenem Bereich.",
        qualifiedMissingUrgency:
          "Wenn das Problem klar ist, aber die Auswirkung fehlt, frage nach Dringlichkeit oder konkreter Einschränkung.",
        qualifiedReady:
          "Wenn das Support-Anliegen klar ist, gib eine kurze Einordnung und leite in Richtung Kontakt oder Übergabe an das Team.",
        contactReady:
          "Wenn der Nutzer Hilfe von einem Menschen möchte, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anruf", "rueckruf", "hilfe vom team", "weiterleiten", "termin"],
        qualifiedNeed: ["support", "hilfe", "problem", "fehler", "funktioniert nicht", "störung", "frage"],
        industry: ["kunde", "produkt", "bestellung", "auftrag", "rechnung", "konto", "vorgang"],
        urgency: ["sofort", "dringend", "schnell", "akut", "heute", "jetzt"],
      },
    },
  },
  appointment: {
    label: "Terminbuchung",
    description: "Für Nutzer, die relativ früh einen Termin oder Rückruf wollen.",
    flow: {
      questions: {
        opening: "Möchtest du eher einen kurzen Termin, einen Rückruf oder erst eine kurze Einschätzung?",
        industry: "Worum geht es grob, damit wir den richtigen Ansprechpartner einplanen können?",
        urgency: "Wann wäre es für dich am besten oder wie zeitnah soll sich jemand melden?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg noch offen ist, kläre schnell die gewünschte Kontaktart und halte das Gespräch kurz.",
        qualifiedMissingIndustry:
          "Wenn der Terminwunsch klar ist, aber das Thema fehlt, frage kurz nach dem Anlass des Gesprächs.",
        qualifiedMissingUrgency:
          "Wenn der Terminwunsch klar ist, aber der Zeithorizont fehlt, frage kurz nach der gewünschten Geschwindigkeit.",
        qualifiedReady:
          "Wenn Kontaktart und Anlass klar sind, leite direkt in die Termin- oder Kontaktaufnahme weiter.",
        contactReady:
          "Wenn der Nutzer bereits zustimmt, bestätige kurz und leite sofort zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["termin", "rueckruf", "rückruf", "anrufen", "telefonat", "gespraech", "gespräch"],
        qualifiedNeed: ["termin", "beratung", "rueckruf", "rückruf", "angebot", "kontakt"],
        industry: ["projekt", "website", "support", "marketing", "ki", "automatisierung", "prozess"],
        urgency: ["morgen", "heute", "diese woche", "zeitnah", "schnell", "sofort"],
      },
    },
  },
  sales: {
    label: "Verkaufsgespräch",
    description: "Für stärker vertriebsorientierte Einstiege mit Fokus auf Potenzial und Abschluss.",
    flow: {
      questions: {
        opening: "Geht es bei dir eher um mehr Anfragen, effizientere Prozesse oder bessere Unterstützung im Tagesgeschäft?",
        industry: "In welcher Branche oder in welchem Geschäftsmodell seid ihr unterwegs?",
        urgency: "Wie stark drückt das Thema gerade oder wie schnell wollt ihr etwas verändern?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, ordne das Potenzial kurz ein und stelle eine konkrete Bedarfsfrage.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Unternehmenskontext fehlt, frage gezielt nach Branche, Zielgruppe oder Geschäftsmodell.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber Priorität oder Druck fehlen, frage gezielt nach Tempo, Aufwand oder aktuellem Schmerz.",
        qualifiedReady:
          "Wenn Potenzial und Kontext klar sind, gib eine kurze Einschätzung und führe selbstbewusst Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer offen für den nächsten Schritt ist, bestätige kurz und leite ohne Umweg zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anfrage", "angebot", "termin", "rueckruf", "rückruf", "sprechen"],
        qualifiedNeed: ["leads", "kunden", "marketing", "vertrieb", "support", "prozesse", "automatisierung", "ki"],
        industry: ["unternehmen", "agentur", "shop", "dienstleistung", "e-commerce", "praxis", "kanzlei"],
        urgency: ["dringend", "zeitnah", "schnell", "dieses quartal", "sofort", "heute"],
      },
    },
  },
  localBusiness: {
    label: "Lokales Unternehmen",
    description: "Für lokale Betriebe mit Fokus auf Anfragen, Erreichbarkeit und Entlastung im Alltag.",
    flow: {
      questions: {
        opening: "Geht es bei dir eher um mehr Anfragen, bessere Erreichbarkeit oder Entlastung im Tagesgeschäft?",
        industry: "Was genau macht euer Betrieb oder in welchem Bereich seid ihr unterwegs?",
        urgency: "Wie stark drückt das Thema gerade im Alltag bei euch?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, ordne kurz ein, dass sich im lokalen Geschäft oft schnell Potenzial zeigt, und stelle eine klare Rückfrage.",
        qualifiedMissingIndustry:
          "Wenn das Ziel klar ist, aber der Betriebskontext fehlt, frage nach Branche, Teamgröße oder typischen Kundenanfragen.",
        qualifiedMissingUrgency:
          "Wenn das Ziel klar ist, aber die Priorität fehlt, frage nach Zeitdruck, Auslastung oder verlorenen Anfragen.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite zügig in Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer offen für Hilfe ist, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "termin", "rueckruf", "rückruf", "anfrage", "sprechen"],
        qualifiedNeed: ["anfragen", "kunden", "erreichbarkeit", "support", "prozesse", "entlastung", "ki"],
        industry: ["betrieb", "lokal", "studio", "salon", "restaurant", "hotel", "praxis", "laden"],
        urgency: ["sofort", "dringend", "schnell", "zeitnah", "heute", "diese woche"],
      },
    },
  },
  agency: {
    label: "Agentur",
    description: "Für Agenturen mit Fokus auf Auslastung, interne Effizienz und bessere Lead-Qualifizierung.",
    flow: {
      questions: {
        opening: "Geht es bei euch eher um interne Entlastung, bessere Lead-Qualifizierung oder mehr Effizienz im Kundenprozess?",
        industry: "Welche Art Agentur seid ihr genau und worauf liegt euer Schwerpunkt?",
        urgency: "Wie stark belastet euch das Thema aktuell im Tagesgeschäft?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, leite schnell auf Prozesse, Lead-Qualifizierung oder Support im Agenturalltag ein.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber die Agentur-Ausrichtung fehlt, frage nach Leistungen, Kundenstruktur oder Teamaufbau.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber Priorität oder Druck fehlen, frage nach Engpässen, Zeitverlust oder wiederkehrenden Aufgaben.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, ordne das Potenzial kurz ein und führe Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer gesprächsbereit ist, bestätige kurz und leite direkt weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anfrage", "termin", "call", "rueckruf", "rückruf"],
        qualifiedNeed: ["agentur", "leads", "prozesse", "support", "automatisierung", "kundenanfragen", "team"],
        industry: ["webdesign", "marketing", "seo", "ads", "branding", "social media", "agentur"],
        urgency: ["dringend", "zeitnah", "schnell", "dieses quartal", "sofort"],
      },
    },
  },
  medicalPractice: {
    label: "Arztpraxis",
    description: "Für Praxen mit Fokus auf Entlastung am Empfang, Standardfragen und strukturierte Kontaktaufnahme.",
    flow: {
      questions: {
        opening: "Geht es bei euch eher um Entlastung bei Anrufen, Standardfragen oder der allgemeinen Erreichbarkeit?",
        industry: "Ist das für eine Arztpraxis, Zahnarztpraxis oder einen anderen medizinischen Bereich gedacht?",
        urgency: "Wie stark merkt ihr die Belastung aktuell im Praxisalltag?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, lenke das Gespräch ruhig auf Erreichbarkeit, Standardfragen oder Entlastung am Empfang.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Praxiskontext fehlt, frage nach Praxisart oder typischen Patientenanliegen.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber die Auswirkung fehlt, frage nach Wartezeiten, Anrufaufkommen oder Teamlast.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite in Richtung Kontakt oder Termin weiter.",
        contactReady:
          "Wenn der Nutzer Kontakt möchte, bestätige kurz und leite direkt zur Kontaktaufnahme weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "termin", "rueckruf", "rückruf", "anfrage"],
        qualifiedNeed: ["praxis", "patienten", "anrufe", "erreichbarkeit", "standardfragen", "support", "entlastung"],
        industry: ["arzt", "zahnarzt", "praxis", "physio", "therapie", "medizin"],
        urgency: ["dringend", "zeitnah", "schnell", "akut", "sofort"],
      },
    },
  },
  lawFirm: {
    label: "Kanzlei",
    description: "Für Kanzleien mit Fokus auf Erstqualifizierung, Standardanfragen und sauberer Kontaktaufnahme.",
    flow: {
      questions: {
        opening: "Geht es eher um Erstqualifizierung von Anfragen, Entlastung im Sekretariat oder bessere Erreichbarkeit?",
        industry: "Ist das für eine Kanzlei oder einen anderen beratenden Bereich gedacht?",
        urgency: "Wie stark belastet euch das Thema aktuell im Tagesgeschäft?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, lenke das Gespräch auf Anfragen, Erreichbarkeit oder Entlastung in der ersten Kommunikation.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Kontext fehlt, frage nach Kanzleiart oder typischen Erstkontakten.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber die Priorität fehlt, frage nach Anfragevolumen, Rückrufen oder Zeitdruck.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, gib eine kurze Einordnung und führe Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer gesprächsbereit ist, bestätige kurz und leite sofort weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anfrage", "termin", "rueckruf", "rückruf", "gespräch"],
        qualifiedNeed: ["kanzlei", "mandanten", "anfragen", "sekretariat", "erreichbarkeit", "support"],
        industry: ["kanzlei", "anwalt", "steuerberater", "notar", "beratung"],
        urgency: ["zeitnah", "dringend", "schnell", "sofort", "diese woche"],
      },
    },
  },
  trades: {
    label: "Handwerk",
    description: "Für Handwerksbetriebe mit Fokus auf Erreichbarkeit, Angebotsanfragen und Entlastung im Tagesgeschäft.",
    flow: {
      questions: {
        opening: "Geht es bei euch eher um mehr Anfragen, weniger Telefonstress oder bessere Abläufe im Tagesgeschäft?",
        industry: "In welchem Handwerksbereich seid ihr unterwegs?",
        urgency: "Wie stark kostet euch das Thema aktuell Zeit oder Nerven?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, führe auf Angebotsanfragen, Erreichbarkeit oder Entlastung im Alltag hin.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Betriebskontext fehlt, frage nach Gewerk oder typischen Kundenanfragen.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber die Auswirkung fehlt, frage nach Zeitverlust, verpassten Anrufen oder Auslastung.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite in Richtung Kontakt oder Termin.",
        contactReady:
          "Wenn der Nutzer bereit ist, bestätige kurz und leite direkt weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "angebot", "anfrage", "termin", "rueckruf", "rückruf"],
        qualifiedNeed: ["handwerk", "angebote", "anfragen", "telefon", "erreichbarkeit", "support", "entlastung"],
        industry: ["elektriker", "sanitär", "heizung", "maler", "dachdecker", "schreiner", "gartenbau"],
        urgency: ["dringend", "schnell", "sofort", "zeitnah", "heute"],
      },
    },
  },
  ecommerce: {
    label: "E-Commerce / Shop",
    description: "Für Shops mit Fokus auf Support, Bestellfragen und Entlastung im Kundenservice.",
    flow: {
      questions: {
        opening: "Geht es eher um Entlastung im Support, Bestellfragen oder mehr Effizienz im Shop-Alltag?",
        industry: "Ist das für einen Online-Shop oder ein anderes E-Commerce-Modell gedacht?",
        urgency: "Wie stark bremst euch das Thema aktuell im Tagesgeschäft aus?",
      },
      instructions: {
        clarify:
          "Wenn der Einstieg allgemein ist, lenke das Gespräch auf Support, Bestellstatus, Standardfragen oder Team-Entlastung.",
        qualifiedMissingIndustry:
          "Wenn der Bedarf klar ist, aber der Shop-Kontext fehlt, frage nach Shop-Modell, Produkten oder Supportaufkommen.",
        qualifiedMissingUrgency:
          "Wenn der Bedarf klar ist, aber die Auswirkung fehlt, frage nach Ticketvolumen, Reaktionszeit oder Belastung im Team.",
        qualifiedReady:
          "Wenn Bedarf und Kontext klar sind, gib eine kurze Einschätzung und leite in Richtung Kontakt oder Termin weiter.",
        contactReady:
          "Wenn der Nutzer Kontakt möchte, bestätige kurz und leite direkt weiter.",
      },
      triggers: {
        contactIntent: ["kontakt", "anfrage", "termin", "rueckruf", "rückruf", "sprechen"],
        qualifiedNeed: ["shop", "support", "bestellung", "kundenservice", "standardfragen", "tickets", "retouren"],
        industry: ["shop", "e-commerce", "onlineshop", "produkte", "bestellungen", "retouren"],
        urgency: ["dringend", "zeitnah", "schnell", "sofort", "peak", "heute"],
      },
    },
  },
};

function normalizeTriggerList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatTriggerList(values: string[]) {
  return values.join(", ");
}

function createDefaultFlowStates(
  questions: ConversationFlowForm["questions"],
  instructions: ConversationFlowForm["instructions"],
): ConversationFlowStateForm[] {
  return [
    {
      id: "contact-ready",
      label: "Kontaktbereit",
      instruction: instructions.contactReady,
      preferredQuestion: "",
      requires: [],
      requiresAny: ["contactIntent", "affirmedContactCta"],
      forbids: [],
      matchAny: [],
    },
    {
      id: "qualified-missing-industry",
      label: "Bedarf klar, Branche fehlt",
      instruction: instructions.qualifiedMissingIndustry,
      preferredQuestion: questions.industry,
      requires: ["qualifiedNeed"],
      requiresAny: [],
      forbids: ["industry"],
      matchAny: [],
    },
    {
      id: "qualified-missing-urgency",
      label: "Bedarf klar, Dringlichkeit fehlt",
      instruction: instructions.qualifiedMissingUrgency,
      preferredQuestion: questions.urgency,
      requires: ["qualifiedNeed", "industry"],
      requiresAny: [],
      forbids: ["urgency"],
      matchAny: [],
    },
    {
      id: "qualified-ready",
      label: "Genug Infos da",
      instruction: instructions.qualifiedReady,
      preferredQuestion: "",
      requires: ["qualifiedNeed", "industry", "urgency"],
      requiresAny: [],
      forbids: [],
      matchAny: [],
    },
    {
      id: "clarify",
      label: "Einstieg / Klärung",
      instruction: instructions.clarify,
      preferredQuestion: questions.opening,
      requires: [],
      requiresAny: [],
      forbids: [],
      matchAny: [],
    },
  ];
}

function deriveInstructionsFromStates(
  states: ConversationFlowStateForm[],
  fallback: ConversationFlowForm["instructions"],
): ConversationFlowForm["instructions"] {
  const byId = new Map(states.map((state) => [state.id, state]));

  return {
    clarify: byId.get("clarify")?.instruction || fallback.clarify,
    qualifiedMissingIndustry:
      byId.get("qualified-missing-industry")?.instruction || fallback.qualifiedMissingIndustry,
    qualifiedMissingUrgency:
      byId.get("qualified-missing-urgency")?.instruction || fallback.qualifiedMissingUrgency,
    qualifiedReady: byId.get("qualified-ready")?.instruction || fallback.qualifiedReady,
    contactReady: byId.get("contact-ready")?.instruction || fallback.contactReady,
  };
}

function normalizeStateSignals(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(FLOW_SIGNAL_OPTIONS.map((option) => option.value));
  return value.filter(
    (entry): entry is ConversationFlowSignal =>
      typeof entry === "string" && allowed.has(entry as ConversationFlowSignal),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTriggerPattern(values: string[]) {
  if (values.length === 0) {
    return undefined;
  }

  return new RegExp(`\\b(${values.map((value) => escapeRegExp(value)).join("|")})\\b`, "i");
}

function compactPreviewText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function evaluateFlowPreview(flow: ConversationFlowForm, history: PreviewMessage[]) {
  const userMessages = history.filter((message) => message.role === "user");
  const assistantMessages = history.filter((message) => message.role === "assistant");
  const latestUserMessage = compactPreviewText(userMessages[userMessages.length - 1]?.content || "");
  const latestAssistantMessage = compactPreviewText(assistantMessages[assistantMessages.length - 1]?.content || "");
  const wholeUserText = userMessages.map((message) => compactPreviewText(message.content)).join("\n");

  const patterns = {
    contactIntent: toTriggerPattern(flow.triggers.contactIntent),
    qualifiedNeed: toTriggerPattern(flow.triggers.qualifiedNeed),
    industry: toTriggerPattern(flow.triggers.industry),
    urgency: toTriggerPattern(flow.triggers.urgency),
  };

  const signals: Record<ConversationFlowSignal, boolean> = {
    contactIntent: Boolean(patterns.contactIntent?.test(wholeUserText)),
    qualifiedNeed: Boolean(patterns.qualifiedNeed?.test(wholeUserText)),
    industry: Boolean(patterns.industry?.test(wholeUserText)),
    urgency: Boolean(patterns.urgency?.test(wholeUserText)),
    affirmedContactCta:
      AFFIRMATION_PATTERN.test(latestUserMessage) && Boolean(patterns.contactIntent?.test(latestAssistantMessage)),
  };

  const matchedState =
    flow.states.find((state) => {
      const requiresSatisfied = state.requires.every((signal) => signals[signal]);
      const requiresAnySatisfied =
        state.requiresAny.length === 0 || state.requiresAny.some((signal) => signals[signal]);
      const forbidsSatisfied = state.forbids.every((signal) => !signals[signal]);
      const extraPattern = toTriggerPattern(state.matchAny);
      const textSatisfied = !extraPattern || extraPattern.test(wholeUserText);

      return requiresSatisfied && requiresAnySatisfied && forbidsSatisfied && textSatisfied;
    }) || flow.states[flow.states.length - 1];

  return {
    matchedState,
    signals,
  };
}

function mergeConversationFlow(value: unknown): ConversationFlowForm {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return mergeConversationFlow(DEFAULT_CONVERSATION_FLOW);
  }

  const raw = value as Record<string, unknown>;
  const rawQuestions =
    raw.questions && typeof raw.questions === "object" && !Array.isArray(raw.questions)
      ? (raw.questions as Record<string, unknown>)
      : {};
  const rawInstructions =
    raw.instructions && typeof raw.instructions === "object" && !Array.isArray(raw.instructions)
      ? (raw.instructions as Record<string, unknown>)
      : {};
  const rawTriggers =
    raw.triggers && typeof raw.triggers === "object" && !Array.isArray(raw.triggers)
      ? (raw.triggers as Record<string, unknown>)
      : {};
  const rawStates = Array.isArray(raw.states) ? raw.states : [];

  const questions: ConversationFlowForm["questions"] = {
    opening:
      typeof rawQuestions.opening === "string" && rawQuestions.opening.trim().length > 0
        ? rawQuestions.opening
        : DEFAULT_CONVERSATION_FLOW.questions.opening,
    industry:
      typeof rawQuestions.industry === "string" && rawQuestions.industry.trim().length > 0
        ? rawQuestions.industry
        : DEFAULT_CONVERSATION_FLOW.questions.industry,
    urgency:
      typeof rawQuestions.urgency === "string" && rawQuestions.urgency.trim().length > 0
        ? rawQuestions.urgency
        : DEFAULT_CONVERSATION_FLOW.questions.urgency,
  };

  const instructions: ConversationFlowForm["instructions"] = {
    clarify:
      typeof rawInstructions.clarify === "string" && rawInstructions.clarify.trim().length > 0
        ? rawInstructions.clarify
        : DEFAULT_CONVERSATION_FLOW.instructions.clarify,
    qualifiedMissingIndustry:
      typeof rawInstructions.qualifiedMissingIndustry === "string" &&
      rawInstructions.qualifiedMissingIndustry.trim().length > 0
        ? rawInstructions.qualifiedMissingIndustry
        : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedMissingIndustry,
    qualifiedMissingUrgency:
      typeof rawInstructions.qualifiedMissingUrgency === "string" &&
      rawInstructions.qualifiedMissingUrgency.trim().length > 0
        ? rawInstructions.qualifiedMissingUrgency
        : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedMissingUrgency,
    qualifiedReady:
      typeof rawInstructions.qualifiedReady === "string" && rawInstructions.qualifiedReady.trim().length > 0
        ? rawInstructions.qualifiedReady
        : DEFAULT_CONVERSATION_FLOW.instructions.qualifiedReady,
    contactReady:
      typeof rawInstructions.contactReady === "string" && rawInstructions.contactReady.trim().length > 0
        ? rawInstructions.contactReady
        : DEFAULT_CONVERSATION_FLOW.instructions.contactReady,
  };

  const states =
    rawStates.length > 0
      ? rawStates
          .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
          .map((entry, index) => ({
            id:
              typeof entry.id === "string" && entry.id.trim().length > 0
                ? entry.id
                : `state-${index + 1}`,
            label: typeof entry.label === "string" ? entry.label : `Schritt ${index + 1}`,
            instruction: typeof entry.instruction === "string" ? entry.instruction : "",
            preferredQuestion: typeof entry.preferredQuestion === "string" ? entry.preferredQuestion : "",
            requires: normalizeStateSignals(entry.requires),
            requiresAny: normalizeStateSignals(entry.requiresAny),
            forbids: normalizeStateSignals(entry.forbids),
            matchAny: Array.isArray(entry.matchAny)
              ? entry.matchAny.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              : [],
          }))
      : createDefaultFlowStates(questions, instructions);

  return {
    questions,
    instructions: deriveInstructionsFromStates(states, instructions),
    triggers: {
      contactIntent: Array.isArray(rawTriggers.contactIntent)
        ? rawTriggers.contactIntent.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.contactIntent,
      qualifiedNeed: Array.isArray(rawTriggers.qualifiedNeed)
        ? rawTriggers.qualifiedNeed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.qualifiedNeed,
      industry: Array.isArray(rawTriggers.industry)
        ? rawTriggers.industry.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.industry,
      urgency: Array.isArray(rawTriggers.urgency)
        ? rawTriggers.urgency.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : DEFAULT_CONVERSATION_FLOW.triggers.urgency,
    },
    states,
  };
}

function updateFlowQuestion(
  flow: ConversationFlowForm,
  key: keyof ConversationFlowForm["questions"],
  next: string,
): ConversationFlowForm {
  const stateQuestionTargets: Partial<Record<keyof ConversationFlowForm["questions"], string>> = {
    opening: "clarify",
    industry: "qualified-missing-industry",
    urgency: "qualified-missing-urgency",
  };

  const targetStateId = stateQuestionTargets[key];
  const states = targetStateId
    ? flow.states.map((state) =>
        state.id === targetStateId
          ? {
              ...state,
              preferredQuestion: next,
            }
          : state,
      )
    : flow.states;

  return {
    ...flow,
    questions: {
      ...flow.questions,
      [key]: next,
    },
    states,
  };
}

function updateFlowStates(flow: ConversationFlowForm, states: ConversationFlowStateForm[]): ConversationFlowForm {
  return {
    ...flow,
    states,
    instructions: deriveInstructionsFromStates(states, flow.instructions),
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatSimpleSuggestedQuestions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const rootQuestions = (value as Record<string, unknown>)["/"];
  if (!Array.isArray(rootQuestions)) {
    return "";
  }

  return rootQuestions.filter((entry): entry is string => typeof entry === "string").join("\n");
}

function parseSimpleSuggestedQuestions(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function WidgetConfigForm({ siteId }: WidgetConfigFormProps) {
  const [form, setForm] = useState({
    siteKey: "",
    domain: "",
    widgetBundleUrl: "",
    systemPrompt: "",
    isActive: true,
    consentRequired: true,
    leadCaptureEnabled: true,
    leadNotificationEmail: "",
    allowedDomains: "",
    simpleSuggestedQuestions: "Was kostet der Service?",
    suggestedQuestionsByPath: "{\n  \"/\": [\"Was kostet der Service?\"]\n}",
    conversationFlow: mergeConversationFlow(DEFAULT_CONVERSATION_FLOW),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/widget/sites/${siteId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Widget-Konfiguration konnte nicht geladen werden.");
        setLoading(false);
        return;
      }

      const suggestedQuestionsByPath = data.suggestedQuestionsByPath || {};
      setForm({
        siteKey: data.siteKey || siteId,
        domain: data.domain || "",
        widgetBundleUrl: data.widgetBundleUrl || "",
        systemPrompt: data.systemPrompt || "",
        isActive: data.isActive ?? true,
        consentRequired: data.consentRequired ?? true,
        leadCaptureEnabled: data.leadCaptureEnabled ?? true,
        leadNotificationEmail: data.leadNotificationEmail || "",
        allowedDomains: (data.allowedDomains || []).join(", "),
        simpleSuggestedQuestions: formatSimpleSuggestedQuestions(suggestedQuestionsByPath),
        suggestedQuestionsByPath: JSON.stringify(suggestedQuestionsByPath, null, 2),
        conversationFlow: mergeConversationFlow(data.conversationFlow),
      });
      setLoading(false);
    }

    load();
  }, [siteId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const leadNotificationEmail = form.leadNotificationEmail.trim();
    if (leadNotificationEmail && !isValidEmail(leadNotificationEmail)) {
      setError("Bitte eine gültige Lead-Empfänger-E-Mail eintragen.");
      setSaving(false);
      return;
    }

    let suggestedQuestionsByPath: Record<string, string[]>;
    try {
      suggestedQuestionsByPath = JSON.parse(form.suggestedQuestionsByPath || "{}");
    } catch {
      setError("Raw Suggested Questions JSON muss gültiges JSON sein.");
      setSaving(false);
      return;
    }

    const simpleSuggestedQuestions = parseSimpleSuggestedQuestions(form.simpleSuggestedQuestions);
    if (simpleSuggestedQuestions.length > 0) {
      suggestedQuestionsByPath = {
        ...suggestedQuestionsByPath,
        "/": simpleSuggestedQuestions,
      };
    }

    const payload = {
      siteKey: form.siteKey,
      domain: form.domain,
      widgetBundleUrl: form.widgetBundleUrl,
      systemPrompt: form.systemPrompt.trim() || undefined,
      isActive: form.isActive,
      consentRequired: form.consentRequired,
      leadCaptureEnabled: form.leadCaptureEnabled,
      leadNotificationEmail: leadNotificationEmail || undefined,
      allowedDomains: form.allowedDomains
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      suggestedQuestionsByPath,
      conversationFlow: form.conversationFlow,
    };

    const res = await fetch(`/api/widget/config/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.message || "Widget-Konfiguration konnte nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setMessage("Widget-Konfiguration gespeichert.");
    setSaving(false);
  }

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="dashboard-card">
      <h2 className="dashboard-card-title">Widget-Konfiguration</h2>
      <div className="dashboard-stack">
        <SectionTitle
          title="Standard-Einstellungen"
          text="Diese Felder reichen für den normalen Handwerker-Erstkontakt."
        />
        <label className="dashboard-checkbox">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span>Widget aktiv</span>
        </label>

        <LeadFlowSettings
          checked={form.leadCaptureEnabled}
          onChange={(value) => setForm({ ...form, leadCaptureEnabled: value })}
        />
        <label className="dashboard-field">
          <span className="dashboard-field-label">Lead-Empfänger-E-Mail</span>
          <Input
            type="email"
            value={form.leadNotificationEmail}
            onChange={(e) => setForm({ ...form, leadNotificationEmail: e.target.value })}
            placeholder="info@unternehmen.de"
          />
          <span className="dashboard-field-hint">
            An diese Adresse werden neue Kundenanfragen aus dem Chat gesendet.
          </span>
        </label>
        <ConsentSettings
          checked={form.consentRequired}
          onChange={(value) => setForm({ ...form, consentRequired: value })}
        />
        <label className="dashboard-field">
          <span className="dashboard-field-label">Suggested Questions</span>
          <textarea
            className="dashboard-textarea"
            rows={4}
            value={form.simpleSuggestedQuestions}
            onChange={(e) => setForm({ ...form, simpleSuggestedQuestions: e.target.value })}
            placeholder={"Was kostet eine Rohrreinigung?\nIch brauche Notdienst\nIch möchte zurückgerufen werden"}
          />
          <span className="dashboard-field-hint">Eine Frage pro Zeile. Wird für den Standardpfad des Widgets gespeichert.</span>
        </label>

        <details className="dashboard-card dashboard-card--soft dashboard-stack dashboard-stack--sm">
          <summary className="dashboard-accordion__summary">Erweitert: technische Einstellungen</summary>
          <div className="dashboard-stack dashboard-stack--sm dashboard-mt-14">
            <Field
              label="Kundenschlüssel"
              value={form.siteKey}
              onChange={(value) => setForm({ ...form, siteKey: value })}
            />
            <Field label="Primäre Domain" value={form.domain} onChange={(value) => setForm({ ...form, domain: value })} />
            <Field
              label="Erlaubte Domains (kommagetrennt)"
              value={form.allowedDomains}
              onChange={(value) => setForm({ ...form, allowedDomains: value })}
            />
            <Field
              label="Widget Bundle URL"
              value={form.widgetBundleUrl}
              onChange={(value) => setForm({ ...form, widgetBundleUrl: value })}
            />
            <label className="dashboard-field">
              <span className="dashboard-field-label">System Prompt</span>
              <textarea
                className="dashboard-textarea"
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                placeholder="Optionaler kundenspezifischer Systemprompt. Leer lassen = globaler Standard."
                style={{ minHeight: 200 }}
              />
            </label>
            <SuggestedQuestionsEditor
              value={form.suggestedQuestionsByPath}
              onChange={(value) => setForm({ ...form, suggestedQuestionsByPath: value })}
            />

            <ConversationFlowEditor
              value={form.conversationFlow}
              onChange={(conversationFlow) => setForm({ ...form, conversationFlow })}
            />
          </div>
        </details>

        <Button onClick={save} disabled={saving}>
          {saving ? "Speichert..." : "Widget-Konfiguration speichern"}
        </Button>
        {message && <p className="dashboard-status dashboard-status--success">{message}</p>}
        {error && <ErrorState message={error} />}
      </div>
    </div>
  );
}

function ConversationFlowEditor({
  value,
  onChange,
}: {
  value: ConversationFlowForm;
  onChange: (value: ConversationFlowForm) => void;
}) {
  const [presetKey, setPresetKey] = useState<keyof typeof FLOW_PRESETS>("leadQualification");
  const [previewScenarioId, setPreviewScenarioId] = useState(FLOW_PREVIEW_SCENARIOS[0]?.id || "opening");
  const selectedPreset = FLOW_PRESETS[presetKey];
  const selectedScenario =
    FLOW_PREVIEW_SCENARIOS.find((scenario) => scenario.id === previewScenarioId) || FLOW_PREVIEW_SCENARIOS[0];
  const preview = evaluateFlowPreview(value, selectedScenario.messages);

  return (
    <div className="dashboard-card" style={{ padding: 20, background: "rgba(255,255,255,0.7)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <h3 className="dashboard-card-title" style={{ marginBottom: 6 }}>
            Conversation Flow
          </h3>
          <p className="dashboard-copy" style={{ marginTop: 0 }}>
            Steuere hier, welche Frage der Bot zuerst stellt, wann er nachhakt und ab wann er Richtung Kontakt geht.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onChange(mergeConversationFlow(DEFAULT_CONVERSATION_FLOW))}
          style={{ width: "auto", minWidth: 180 }}
        >
          Standard wiederherstellen
        </Button>
      </div>

      <div className="dashboard-stack" style={{ marginTop: 20 }}>
        <div className="dashboard-card dashboard-card--soft">
          <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Vorlage</span>
              <Select value={presetKey} onChange={(e) => setPresetKey(e.target.value as keyof typeof FLOW_PRESETS)}>
                {Object.entries(FLOW_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="dashboard-field">
              <span className="dashboard-field-label">Beschreibung</span>
              <p className="dashboard-copy" style={{ margin: 0 }}>
                {selectedPreset.description}
              </p>
            </div>
          </div>
          <div className="dashboard-inline" style={{ marginTop: 14 }}>
            <Button
              type="button"
              onClick={() => onChange(mergeConversationFlow(selectedPreset.flow))}
              style={{ width: "auto", minWidth: 180 }}
            >
              Vorlage anwenden
            </Button>
            <p className="dashboard-copy" style={{ margin: 0 }}>
              Ueberschreibt die Felder unten mit der gewählten Vorlage.
            </p>
          </div>
        </div>

        <SectionTitle title="Fragen" text="Diese Fragen nutzt der Bot bevorzugt in den jeweiligen Phasen." />
        <TextareaField
          label="Einstiegsfrage"
          value={value.questions.opening}
          onChange={(next) => onChange(updateFlowQuestion(value, "opening", next))}
        />
        <TextareaField
          label="Branchenfrage"
          value={value.questions.industry}
          onChange={(next) => onChange(updateFlowQuestion(value, "industry", next))}
        />
        <TextareaField
          label="Dringlichkeitsfrage"
          value={value.questions.urgency}
          onChange={(next) => onChange(updateFlowQuestion(value, "urgency", next))}
        />

        <SectionTitle
          title="Schrittzustände & Verzweigungen"
          text="Diese Zustände werden in Reihenfolge geprüft. So bekommt der Bot feste Branches statt nur allgemeiner Heuristiken."
        />
        <div className="dashboard-stack" style={{ gap: 16 }}>
          {value.states.map((state, index) => (
            <ConversationStateCard
              key={state.id}
              state={state}
              index={index}
              canMoveUp={index > 0}
              canMoveDown={index < value.states.length - 1}
              onChange={(nextState) =>
                onChange(
                  updateFlowStates(
                    value,
                    value.states.map((entry, entryIndex) => (entryIndex === index ? nextState : entry)),
                  ),
                )
              }
              onRemove={
                value.states.length > 1
                  ? () =>
                      onChange(updateFlowStates(value, value.states.filter((_, entryIndex) => entryIndex !== index)))
                  : undefined
              }
              onMoveUp={
                index > 0
                  ? () => {
                      const nextStates = value.states.slice();
                      [nextStates[index - 1], nextStates[index]] = [nextStates[index], nextStates[index - 1]];
                      onChange(updateFlowStates(value, nextStates));
                    }
                  : undefined
              }
              onMoveDown={
                index < value.states.length - 1
                  ? () => {
                      const nextStates = value.states.slice();
                      [nextStates[index], nextStates[index + 1]] = [nextStates[index + 1], nextStates[index]];
                      onChange(updateFlowStates(value, nextStates));
                    }
                  : undefined
              }
            />
          ))}
          <div className="dashboard-inline">
            <Button
              type="button"
              onClick={() =>
                onChange(
                  updateFlowStates(
                    value,
                    [
                      ...value.states.filter((state) => state.id !== "clarify"),
                      {
                        id: `branch-${Date.now()}`,
                        label: `Neuer Branch ${value.states.length + 1}`,
                        instruction: "Beschreibe hier, wie der Bot in diesem Branch kurz reagieren soll.",
                        preferredQuestion: "",
                        requires: [],
                        requiresAny: [],
                        forbids: [],
                        matchAny: [],
                      },
                      ...value.states.filter((state) => state.id === "clarify"),
                    ],
                  ),
                )
              }
              style={{ width: "auto", minWidth: 180 }}
            >
              Branch hinzufügen
            </Button>
            <p className="dashboard-copy" style={{ margin: 0 }}>
              Neue Branches werden vor dem allgemeinen Fallback eingefügt und können per Hoch/Runter sortiert werden.
            </p>
          </div>
        </div>

        <SectionTitle
          title="Triggerwörter"
          text="Kommagetrennte Wörter oder Phrasen, an denen der Bot bestimmte Phasen erkennt."
        />
        <TriggerField
          label="Kontaktwunsch"
          value={value.triggers.contactIntent}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, contactIntent: next },
            })
          }
        />
        <TriggerField
          label="Klarer Bedarf"
          value={value.triggers.qualifiedNeed}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, qualifiedNeed: next },
            })
          }
        />
        <TriggerField
          label="Branchenkontext"
          value={value.triggers.industry}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, industry: next },
            })
          }
        />
        <TriggerField
          label="Dringlichkeit"
          value={value.triggers.urgency}
          onChange={(next) =>
            onChange({
              ...value,
              triggers: { ...value.triggers, urgency: next },
            })
          }
        />

        <SectionTitle
          title="Live-Vorschau"
          text="So kannst du direkt im Dashboard prüfen, welcher Branch bei einem Beispielgespräch greifen würde."
        />
        <div className="dashboard-card dashboard-card--soft">
          <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
            <label className="dashboard-field">
              <span className="dashboard-field-label">Beispielverlauf</span>
              <Select value={previewScenarioId} onChange={(e) => setPreviewScenarioId(e.target.value)}>
                {FLOW_PREVIEW_SCENARIOS.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="dashboard-field">
              <span className="dashboard-field-label">Einordnung</span>
              <p className="dashboard-copy" style={{ margin: 0 }}>
                {selectedScenario.description}
              </p>
            </div>
          </div>

          <div className="dashboard-stack" style={{ gap: 10, marginTop: 14 }}>
            {selectedScenario.messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className="dashboard-card"
                style={{
                  padding: 12,
                  background: message.role === "assistant" ? "rgba(255,255,255,0.9)" : "rgba(255,246,232,0.85)",
                }}
              >
                <strong>{message.role === "assistant" ? "Assistent" : "Nutzer"}</strong>
                <p className="dashboard-copy" style={{ margin: "6px 0 0" }}>
                  {message.content}
                </p>
              </div>
            ))}
          </div>

          <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14, marginTop: 16 }}>
            <div className="dashboard-card">
              <span className="dashboard-field-label">Aktiver Branch</span>
              <h4 className="dashboard-card-title" style={{ margin: "8px 0 4px" }}>
                {preview.matchedState?.label || "Kein Branch"}
              </h4>
              <p className="dashboard-copy" style={{ margin: 0 }}>
                ID: {preview.matchedState?.id || "unbekannt"}
              </p>
              <p className="dashboard-copy" style={{ marginTop: 12 }}>
                {preview.matchedState?.instruction || "Keine Anweisung hinterlegt."}
              </p>
              {preview.matchedState?.preferredQuestion ? (
                <p className="dashboard-copy" style={{ marginTop: 12 }}>
                  <strong>Bevorzugte Rückfrage:</strong> {preview.matchedState.preferredQuestion}
                </p>
              ) : null}
            </div>

            <div className="dashboard-card">
              <span className="dashboard-field-label">Erkannte Signale</span>
              <div className="dashboard-stack" style={{ gap: 8, marginTop: 10 }}>
                {FLOW_SIGNAL_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className="dashboard-inline"
                    style={{ justifyContent: "space-between", gap: 12 }}
                  >
                    <span>{option.label}</span>
                    <strong>{preview.signals[option.value] ? "Ja" : "Nein"}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationStateCard({
  state,
  index,
  canMoveUp,
  canMoveDown,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  state: ConversationFlowStateForm;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (value: ConversationFlowStateForm) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="dashboard-card dashboard-card--soft">
      <div className="dashboard-inline" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h4 className="dashboard-card-title" style={{ marginBottom: 6 }}>
            Schritt {index + 1}
          </h4>
          <p className="dashboard-copy" style={{ marginTop: 0 }}>
            Dieser Branch greift, wenn alle Muss-Signale passen und keine Ausschluss-Signale aktiv sind.
          </p>
        </div>
        <div className="dashboard-inline" style={{ gap: 8 }}>
          <Button type="button" onClick={onMoveUp} disabled={!canMoveUp} style={{ width: "auto", minWidth: 90 }}>
            Hoch
          </Button>
          <Button type="button" onClick={onMoveDown} disabled={!canMoveDown} style={{ width: "auto", minWidth: 90 }}>
            Runter
          </Button>
          {onRemove ? (
            <Button type="button" onClick={onRemove} style={{ width: "auto", minWidth: 140 }}>
              Branch löschen
            </Button>
          ) : null}
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
        <Field label="Branch-ID" value={state.id} onChange={(value) => onChange({ ...state, id: value })} />
        <Field label="Titel" value={state.label} onChange={(value) => onChange({ ...state, label: value })} />
      </div>

      <TextareaField
        label="Anweisung für diesen Zustand"
        value={state.instruction}
        onChange={(value) => onChange({ ...state, instruction: value })}
      />
      <TextareaField
        label="Bevorzugte Rückfrage"
        value={state.preferredQuestion}
        onChange={(value) => onChange({ ...state, preferredQuestion: value })}
      />

      <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
        <SignalChecklist
          label="Muss vorhanden sein"
          value={state.requires}
          onChange={(value) => onChange({ ...state, requires: value })}
        />
        <SignalChecklist
          label="Mindestens eines davon"
          value={state.requiresAny}
          onChange={(value) => onChange({ ...state, requiresAny: value })}
        />
      </div>

      <div className="dashboard-grid dashboard-grid--split" style={{ gap: 14 }}>
        <SignalChecklist
          label="Darf noch nicht vorhanden sein"
          value={state.forbids}
          onChange={(value) => onChange({ ...state, forbids: value })}
        />
        <TriggerField
          label="Zusätzliche Triggerwörter (optional)"
          value={state.matchAny}
          onChange={(value) => onChange({ ...state, matchAny: value })}
        />
      </div>
    </div>
  );
}

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="dashboard-card-title" style={{ marginBottom: 6 }}>
        {title}
      </h3>
      <p className="dashboard-copy" style={{ marginTop: 0 }}>
        {text}
      </p>
    </div>
  );
}

function SignalChecklist({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ConversationFlowSignal[];
  onChange: (value: ConversationFlowSignal[]) => void;
}) {
  return (
    <div className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <div className="dashboard-stack" style={{ gap: 8 }}>
        {FLOW_SIGNAL_OPTIONS.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label key={option.value} className="dashboard-checkbox">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? Array.from(new Set([...value, option.value]))
                      : value.filter((entry) => entry !== option.value),
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <textarea
        className="dashboard-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 110 }}
      />
    </label>
  );
}

function TriggerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <label className="dashboard-field">
      <span className="dashboard-field-label">{label}</span>
      <Input value={formatTriggerList(value)} onChange={(e) => onChange(normalizeTriggerList(e.target.value))} />
    </label>
  );
}
