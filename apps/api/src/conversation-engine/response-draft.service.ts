import { Injectable } from '@nestjs/common';
import { AssistantProfile } from '../assistant-profiles';
import {
  ConversationDecision,
  ConversationEngineResponsePreview,
  ConversationHistoryEntry,
  EngineResponseDraft,
} from './conversation-engine.types';
import { ConversationQualityService } from './conversation-quality.service';

type ResponseDraftInput = {
  assistantProfile: AssistantProfile;
  decision: ConversationDecision;
  latestUserMessage: string;
  history?: ConversationHistoryEntry[];
  knowledgeAvailable: boolean;
  testMode: true;
};

const FIELD_LABELS: Record<string, string> = {
  problem: 'Anliegen',
  urgency: 'Dringlichkeit',
  fullAddress: 'vollständige Adresse',
  fullName: 'Vor- und Nachname',
  phone: 'Telefonnummer',
  email: 'E-Mail-Adresse',
  reporterEmail: 'Kontaktadresse',
  impact: 'Auswirkung',
  affectedSystem: 'betroffenes System',
  description: 'Beschreibung',
};

function firstMissingLabel(fields: string[]) {
  const first = fields[0];
  return first ? FIELD_LABELS[first] || first : null;
}

function questionCount(text: string) {
  return (text.match(/\?/g) || []).length;
}

function buildDraft(input: ResponseDraftInput): EngineResponseDraft {
  const decision = input.decision;
  const missing = firstMissingLabel(decision.missingFields);
  const confidence = decision.confidence;
  const base = {
    usedKnowledgeSources: [],
    missingFields: decision.missingFields,
    confidence,
  };

  if (decision.intent === 'support' || decision.goal === 'solve_problem') {
    const askedQuestion = 'Welche Fehlermeldung sehen Sie?';
    return {
      ...base,
      mode: 'support_guidance',
      text:
        'Verstanden, das klingt nach einem Supportfall. Ich würde zuerst eingrenzen, ob der Zugriff gar nicht startet, ein Login-Fehler erscheint oder nur bestimmte Systeme betroffen sind. Welche Fehlermeldung sehen Sie?',
      usedKnowledge: input.knowledgeAvailable,
      askedQuestion,
      nextActionLabel: 'Supportproblem eingrenzen',
      shouldShowSources: false,
      shouldAskQuestion: true,
      shouldHandoff: false,
    };
  }

  if (decision.intent === 'product_advice' || decision.goal === 'recommend_product') {
    const askedQuestion = 'Wofür soll die Lösung hauptsächlich eingesetzt werden?';
    return {
      ...base,
      mode: 'product_advice',
      text:
        'Das lässt sich eingrenzen. Sinnvoll wäre zuerst zu klären, ob Sie eher Unterstützung für Kundenanfragen, interne Supportprozesse oder Produkt- und Leistungsberatung benötigen. Wofür soll die Lösung hauptsächlich eingesetzt werden?',
      usedKnowledge: input.knowledgeAvailable,
      askedQuestion,
      nextActionLabel: 'Beratungsbedarf eingrenzen',
      shouldShowSources: false,
      shouldAskQuestion: true,
      shouldHandoff: false,
    };
  }

  if (decision.intent === 'appointment' || decision.goal === 'trigger_integration') {
    const askedQuestion = missing ? `Bitte nennen Sie noch: ${missing}.` : 'Welcher Zeitraum passt Ihnen am besten?';
    return {
      ...base,
      mode: 'appointment_preparation',
      text: missing
        ? `Gerne. Ich bereite den Terminwunsch vor. Dafür fehlt noch eine Angabe: ${missing}.`
        : 'Gerne. Ich bereite den Terminwunsch vor. Welcher Zeitraum passt Ihnen am besten?',
      usedKnowledge: false,
      askedQuestion,
      nextActionLabel: decision.goal === 'trigger_integration' ? 'Termin-Integration vorbereiten' : 'Terminübergabe vorbereiten',
      shouldShowSources: false,
      shouldAskQuestion: true,
      shouldHandoff: true,
    };
  }

  if (decision.intent === 'complaint' || decision.goal === 'escalate_human') {
    const askedQuestion = 'Worum ging es ursprünglich?';
    return {
      ...base,
      mode: 'complaint_escalation',
      text:
        'Das ist nachvollziehbar. Ich fasse den Fall gern für das Team zusammen, damit er gezielt geprüft werden kann. Worum ging es ursprünglich?',
      usedKnowledge: false,
      askedQuestion,
      nextActionLabel: 'Beschwerde für menschliche Prüfung vorbereiten',
      shouldShowSources: false,
      shouldAskQuestion: true,
      shouldHandoff: true,
    };
  }

  if (decision.intent === 'unknown' || decision.goal === 'clarify_intent') {
    const askedQuestion = 'Was davon passt am ehesten zu Ihrem Ziel?';
    return {
      ...base,
      mode: 'clarification',
      text:
        'Kein Problem. Meist gibt es drei Einstiegspunkte: Fragen automatisch beantworten, Anfragen strukturiert aufnehmen oder Supportfälle vorbereiten. Was davon passt am ehesten zu Ihrem Ziel?',
      usedKnowledge: false,
      askedQuestion,
      nextActionLabel: 'Absicht klären',
      shouldShowSources: false,
      shouldAskQuestion: true,
      shouldHandoff: false,
    };
  }

  if (decision.goal === 'answer_from_knowledge') {
    const hasKnowledge = input.knowledgeAvailable;
    return {
      ...base,
      mode: 'knowledge_answer',
      text: hasKnowledge
        ? 'Ich würde die Antwort aus der freigegebenen Wissensbasis ableiten und die wichtigsten Punkte kurz zusammenfassen.'
        : 'Dazu liegt mir im Testmodus keine sichere Wissensgrundlage vor. Ich würde transparent nach weiteren Informationen fragen oder eine Übergabe vorbereiten.',
      usedKnowledge: hasKnowledge,
      nextActionLabel: hasKnowledge ? 'Wissensantwort formulieren' : 'Wissenslücke klären',
      shouldShowSources: false,
      shouldAskQuestion: !hasKnowledge,
      shouldHandoff: false,
    };
  }

  if (decision.goal === 'prepare_contact' || decision.goal === 'collect_request') {
    const askedQuestion = missing ? `Bitte nennen Sie noch: ${missing}.` : undefined;
    return {
      ...base,
      mode: 'handoff_preparation',
      text: missing
        ? `Ich bereite die Anfrage strukturiert vor. Dafür fehlt noch: ${missing}.`
        : 'Ich würde die Angaben kurz zusammenfassen und die Übergabe an das zuständige Team vorbereiten.',
      usedKnowledge: input.knowledgeAvailable && decision.intent === 'sales',
      askedQuestion,
      nextActionLabel: missing ? `${missing} erfragen` : 'Übergabe vorbereiten',
      shouldShowSources: false,
      shouldAskQuestion: Boolean(missing),
      shouldHandoff: true,
    };
  }

  return {
    ...base,
    mode: 'clarification',
    text: 'Ich würde den Bedarf kurz einordnen und mit einer Rückfrage den nächsten sinnvollen Schritt klären.',
    usedKnowledge: false,
    askedQuestion: 'Welcher nächste Schritt ist für Sie am wichtigsten?',
    nextActionLabel: 'Nächsten Schritt klären',
    shouldShowSources: false,
    shouldAskQuestion: true,
    shouldHandoff: false,
  };
}

@Injectable()
export class ResponseDraftService {
  constructor(private readonly quality: ConversationQualityService) {}

  preview(input: ResponseDraftInput): ConversationEngineResponsePreview {
    const warnings: string[] = [];
    const reasons = ['Antwortsimulation im Admin-Testmodus; keine produktiven Aktionen werden ausgeführt.'];
    if (!input.testMode) {
      warnings.push('Antwortsimulation ist nur im Testmodus erlaubt.');
    }
    if (input.assistantProfile.knowledgeMode === 'strict' && !input.knowledgeAvailable) {
      warnings.push('Strict Knowledge Mode aktiv, aber keine Wissensbasis verfügbar.');
    }

    const draft = buildDraft(input);
    if (questionCount(draft.text) > 1) {
      warnings.push('Simulation enthält mehr als eine Rückfrage.');
    }

    return {
      enabled: true,
      decision: input.decision,
      draft,
      quality: this.quality.evaluateDraft(input.assistantProfile, input.decision, draft),
      safety: {
        noSideEffects: true,
        publicWidgetUnaffected: true,
        integrationsSuppressed: true,
        sanitized: true,
      },
      warnings,
      reasons,
    };
  }
}
