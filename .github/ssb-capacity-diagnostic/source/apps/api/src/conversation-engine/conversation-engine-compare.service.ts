import { Injectable } from '@nestjs/common';
import { AssistantProfile } from '../assistant-profiles';
import { ConversationEngineService } from './conversation-engine.service';
import { ConversationDecision, ConversationEnginePreviewInput } from './conversation-engine.types';

type LegacyPreview = {
  replyPreview: string;
  route: 'knowledge' | 'local_service_intake' | 'lead_capture' | 'ticket' | 'unknown';
  usedKnowledge: boolean;
  wouldCreateLead: boolean;
  wouldCreateTicket: boolean;
  wouldTriggerIntegration: boolean;
  warnings: string[];
};

type ComparisonResult = {
  status: 'aligned' | 'partial' | 'conflict' | 'unknown';
  findings: string[];
  risks: string[];
  recommendations: string[];
};

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function hasAny(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function isQuestion(text: string) {
  return text.endsWith('?') || hasAny(text, /\b(was|wie|warum|wann|wo|welche|kann|kostet|kosten|preis)\b/i);
}

function hasLocalServiceSignal(text: string) {
  return hasAny(text, /\b(notdienst|notfall|toilette|wc|klo|abfluss|rohr|rohrreinigung|kanal|keller|rückstau|rueckstau|verstopft|wasser)\b/i);
}

function hasContactSignal(text: string) {
  return hasAny(text, /\b(rückruf|rueckruf|zurückrufen|zurueckrufen|anrufen|kontakt|melden|angebot)\b/i);
}

function hasTicketSignal(text: string) {
  return hasAny(text, /\b(ticket|supportfall|störung|stoerung|vpn|outlook|drucker|login|mfa|passwort)\b/i);
}

function expectedMatches(expected: string | undefined, actual: string | null | undefined) {
  if (!expected) return null;
  return expected.split('|').map((entry) => entry.trim()).includes(actual || '');
}

function firstMissingField(decision: ConversationDecision) {
  return decision.missingFields[0] || null;
}

@Injectable()
export class ConversationEngineCompareService {
  constructor(private readonly engine: ConversationEngineService) {}

  compare(input: ConversationEnginePreviewInput) {
    const engineDecision = this.engine.preview(input);
    const legacy = this.simulateLegacy(input.assistantProfile, input.latestUserMessage, engineDecision);
    return {
      legacy,
      engine: {
        conversationDecision: engineDecision,
      },
      comparison: this.compareDecisions(legacy, engineDecision, input),
    };
  }

  private simulateLegacy(
    assistantProfile: AssistantProfile,
    latestUserMessage: string,
    engineDecision: ConversationDecision,
  ): LegacyPreview {
    const text = normalizeText(latestUserMessage);
    const warnings = ['Legacy-Antwort wurde im Compare-Modus trocken simuliert; keine produktive Pipeline wurde ausgeführt.'];
    const isLocalService = assistantProfile.profileKey === 'local-service-first-contact' ||
      assistantProfile.enabledTasks.includes('local_service_intake');

    if (isQuestion(text) && !hasLocalServiceSignal(text) && !hasContactSignal(text)) {
      return {
        replyPreview: 'Legacy würde voraussichtlich eine Wissens-/FAQ-Antwort erzeugen.',
        route: 'knowledge',
        usedKnowledge: true,
        wouldCreateLead: false,
        wouldCreateTicket: false,
        wouldTriggerIntegration: false,
        warnings,
      };
    }

    if (isLocalService && (hasLocalServiceSignal(text) || text.length > 8)) {
      const missing = firstMissingField(engineDecision);
      return {
        replyPreview: missing
          ? `Legacy würde voraussichtlich im Erstkontakt bleiben und ${missing} erfragen.`
          : 'Legacy würde voraussichtlich eine Anfrage als vollständig behandeln.',
        route: 'local_service_intake',
        usedKnowledge: false,
        wouldCreateLead: engineDecision.missingFields.length === 0,
        wouldCreateTicket: false,
        wouldTriggerIntegration: false,
        warnings,
      };
    }

    if (hasTicketSignal(text)) {
      return {
        replyPreview: 'Legacy würde voraussichtlich einen Support-/Ticketpfad prüfen.',
        route: 'ticket',
        usedKnowledge: false,
        wouldCreateLead: false,
        wouldCreateTicket: engineDecision.missingFields.length === 0,
        wouldTriggerIntegration: false,
        warnings,
      };
    }

    if (hasContactSignal(text)) {
      return {
        replyPreview: 'Legacy würde voraussichtlich Richtung Kontaktaufnahme führen.',
        route: 'lead_capture',
        usedKnowledge: false,
        wouldCreateLead: engineDecision.missingFields.length === 0,
        wouldCreateTicket: false,
        wouldTriggerIntegration: false,
        warnings,
      };
    }

    return {
      replyPreview: 'Legacy ist in diesem Dry-Run nicht sicher simulierbar.',
      route: 'unknown',
      usedKnowledge: false,
      wouldCreateLead: false,
      wouldCreateTicket: false,
      wouldTriggerIntegration: false,
      warnings: [...warnings, 'Keine sichere Legacy-Route ableitbar.'],
    };
  }

  private compareDecisions(
    legacy: LegacyPreview,
    decision: ConversationDecision,
    input: ConversationEnginePreviewInput,
  ): ComparisonResult {
    const findings: string[] = [];
    const risks: string[] = [];
    const recommendations: string[] = [];
    const expectedIntentMatch = expectedMatches(input.expectedIntent, decision.intent);
    const expectedGoalMatch = expectedMatches(input.expectedGoal, decision.goal);
    const expectedAgentMatch = expectedMatches(input.expectedAgentKey, decision.selectedAgentKey);
    const expectedMatchesEngine =
      expectedIntentMatch !== false &&
      expectedGoalMatch !== false &&
      expectedAgentMatch !== false &&
      (expectedIntentMatch === true || expectedGoalMatch === true || expectedAgentMatch === true);

    if (decision.confidence < 0.45) {
      recommendations.push('Testfall manuell prüfen oder weitere Kontextdaten ergänzen.');
      return {
        status: 'unknown',
        findings: ['Neue Engine ist nicht eindeutig genug.'],
        risks: ['Automatischer Vergleich ist für diesen Testfall nur eingeschränkt aussagekräftig.'],
        recommendations,
      };
    }

    if (legacy.route === 'unknown' && expectedMatchesEngine) {
      findings.push('Legacy konnte nicht eindeutig simuliert werden, die Engine passt aber zur hinterlegten Erwartung.');
      recommendations.push('Legacy-Simulation für diesen Intent optional erweitern; Engine-Entscheidung im Admin-Testchat prüfen.');
      return { status: 'partial', findings, risks, recommendations };
    }

    if (legacy.route === 'unknown') {
      recommendations.push('Testfall manuell prüfen oder weitere Kontextdaten ergänzen.');
      return {
        status: 'unknown',
        findings: ['Legacy ist nicht eindeutig simulierbar und es liegt keine passende Erwartungsbewertung vor.'],
        risks: ['Automatischer Vergleich ist für diesen Testfall nur eingeschränkt aussagekräftig.'],
        recommendations,
      };
    }

    if (legacy.route === 'knowledge' && decision.goal === 'answer_from_knowledge') {
      findings.push('Legacy und neue Engine priorisieren eine Wissensantwort.');
      return { status: 'aligned', findings, risks, recommendations };
    }

    if (
      (legacy.route === 'lead_capture' || legacy.route === 'local_service_intake') &&
      (decision.goal === 'collect_request' || decision.goal === 'prepare_contact')
    ) {
      if (decision.missingFields.length > 0) {
        findings.push('Beide Pfade bleiben in der Datenerfassung, aber Pflichtfelder fehlen noch.');
        return { status: 'partial', findings, risks, recommendations };
      }
      findings.push('Legacy und neue Engine sehen eine Kontakt-/Anfrageübergabe als passend.');
      return { status: 'aligned', findings, risks, recommendations };
    }

    if (
      legacy.route === 'local_service_intake' &&
      ['support', 'product_advice', 'question'].includes(decision.intent)
    ) {
      findings.push('Legacy würde Local-Service-Intake starten, die neue Engine erkennt eine andere Absicht.');
      risks.push('Mögliche Fehlführung im Legacy-Flow bei branchenfremden Fragen.');
      recommendations.push('Profil, Trigger oder Pflichtfeldlogik für diesen Fall prüfen.');
      return { status: 'conflict', findings, risks, recommendations };
    }

    if (legacy.route === 'ticket' && decision.goal === 'create_ticket') {
      findings.push('Beide Pfade tendieren zu Ticket-Erstellung.');
      return { status: 'aligned', findings, risks, recommendations };
    }

    findings.push('Legacy und neue Engine sind teilweise kompatibel, aber nicht deckungsgleich.');
    recommendations.push('Antwort und Engine-Entscheidung im Admin-Testchat manuell vergleichen.');
    return { status: 'partial', findings, risks, recommendations };
  }
}
