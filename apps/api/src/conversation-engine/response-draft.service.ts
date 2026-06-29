import { Injectable } from '@nestjs/common';
import { AssistantProfile } from '../assistant-profiles';
import {
  ConversationDecision,
  ConversationEngineResponsePreview,
  ConversationHistoryEntry,
  EngineKnowledgeRetrievalResult,
  EngineKnowledgeSnippet,
  EngineResponseDraft,
} from './conversation-engine.types';
import { ConversationQualityService } from './conversation-quality.service';

type ResponseDraftInput = {
  assistantProfile: AssistantProfile;
  decision: ConversationDecision;
  latestUserMessage: string;
  history?: ConversationHistoryEntry[];
  knowledgeAvailable: boolean;
  knowledgeRetrievalResult?: EngineKnowledgeRetrievalResult;
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
  const snippets = input.knowledgeRetrievalResult?.snippets || [];
  const knowledgeStatus = input.knowledgeRetrievalResult?.status || (input.knowledgeAvailable ? 'available' : 'empty');
  const hasSnippets = snippets.length > 0;
  const knowledgeMode = input.assistantProfile.knowledgeMode;
  const base = {
    usedKnowledgeSources: [] as EngineKnowledgeSnippet[],
    groundingStatus: 'not_required' as EngineResponseDraft['groundingStatus'],
    groundingWarnings: [] as string[],
    missingFields: decision.missingFields,
    confidence,
  };

  const knowledgeBase = {
    ...base,
    usedKnowledgeSources: snippets,
    groundingStatus: hasSnippets ? 'grounded' as const : 'ungrounded' as const,
    groundingWarnings: hasSnippets ? [] : ['Keine passende Wissensbasis gefunden.'],
  };

  const sourceTitle = snippets[0]?.title || 'der Wissensbasis';
  const sourceExcerpt = snippets[0]?.excerpt || '';
  const sourceSentence = sourceExcerpt
    ? `Aus ${sourceTitle} geht hervor: ${sourceExcerpt.slice(0, 110)}${sourceExcerpt.length > 110 ? '…' : ''}`
    : `Ich würde die Antwort aus ${sourceTitle} ableiten.`;

  const noKnowledgeText = knowledgeMode === 'strict'
    ? 'Dazu wurde in der freigegebenen Wissensbasis keine sichere Grundlage gefunden. Ich würde das transparent machen und eine Rückfrage oder Übergabe vorbereiten.'
    : 'Dazu wurde keine passende Wissensbasis gefunden. Ich kann allgemein einordnen und eine passende Rückfrage stellen, ohne eine Quelle zu behaupten.';

  if (decision.intent === 'support' || decision.goal === 'solve_problem') {
    const askedQuestion = 'Welche Fehlermeldung sehen Sie?';
    const text = hasSnippets
      ? `${sourceSentence}\n\nAls nächsten Schritt würde ich eingrenzen, ob der Fehler beim Start, beim Login oder nur in einem bestimmten System auftritt. Welche Fehlermeldung sehen Sie?`
      : 'Verstanden, das klingt nach einem Supportfall. Ich würde zuerst eingrenzen, ob der Zugriff gar nicht startet, ein Login-Fehler erscheint oder nur bestimmte Systeme betroffen sind. Welche Fehlermeldung sehen Sie?';
    return {
      ...(hasSnippets ? knowledgeBase : base),
      mode: 'support_guidance',
      text,
      usedKnowledge: hasSnippets,
      askedQuestion,
      nextActionLabel: 'Supportproblem eingrenzen',
      shouldShowSources: hasSnippets,
      shouldAskQuestion: true,
      shouldHandoff: false,
    };
  }

  if (decision.intent === 'product_advice' || decision.goal === 'recommend_product') {
    const askedQuestion = 'Wofür soll die Lösung hauptsächlich eingesetzt werden?';
    const text = hasSnippets
      ? `${sourceSentence}\n\nDarauf aufbauend würde ich die passende Lösung nur aus den freigegebenen Informationen ableiten. Wofür soll die Lösung hauptsächlich eingesetzt werden?`
      : 'Das lässt sich eingrenzen. Sinnvoll wäre zuerst zu klären, ob Sie eher Unterstützung für Kundenanfragen, interne Supportprozesse oder Produkt- und Leistungsberatung benötigen. Wofür soll die Lösung hauptsächlich eingesetzt werden?';
    return {
      ...(hasSnippets ? knowledgeBase : base),
      mode: 'product_advice',
      text,
      usedKnowledge: hasSnippets,
      askedQuestion,
      nextActionLabel: 'Beratungsbedarf eingrenzen',
      shouldShowSources: hasSnippets,
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
    return {
      ...(hasSnippets ? knowledgeBase : {
        ...base,
        groundingStatus: knowledgeStatus === 'disabled' ? 'not_required' as const : 'ungrounded' as const,
        groundingWarnings: knowledgeStatus === 'disabled' ? [] : ['Keine passende Wissensbasis gefunden.'],
      }),
      mode: 'knowledge_answer',
      text: hasSnippets
        ? `${sourceSentence}\n\nIch würde daraus eine kurze Antwort formulieren und die Quelle als Hinweis anzeigen.`
        : noKnowledgeText,
      usedKnowledge: hasSnippets,
      nextActionLabel: hasSnippets ? 'Wissensantwort formulieren' : 'Wissenslücke klären',
      shouldShowSources: hasSnippets,
      shouldAskQuestion: !hasSnippets,
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
      usedKnowledge: hasSnippets && decision.intent === 'sales',
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
      knowledgeRetrieval: input.knowledgeRetrievalResult,
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
