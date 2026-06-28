import { Injectable } from '@nestjs/common';
import { AssistantProfile } from '../assistant-profiles';
import {
  ConversationContext,
  ConversationDecision,
  EngineResponseDraft,
  EngineResponseQuality,
} from './conversation-engine.types';

@Injectable()
export class ConversationQualityService {
  finalize(context: ConversationContext, decision: ConversationDecision): ConversationDecision {
    const warnings = [...decision.warnings];

    if (!context.assistantProfile.conversationEngine.enabled) {
      warnings.push('ConversationEngine ist im Profil deaktiviert.');
    }

    if (context.assistantProfile.enabledAgents.length === 0) {
      warnings.push('Kein Agent aktiviert.');
    }

    if (decision.shouldUseKnowledge && !context.knowledgeAvailable && context.assistantProfile.knowledgeMode === 'strict') {
      warnings.push('Strict Knowledge Mode, aber keine Wissensbasis verfügbar.');
    }

    return {
      ...decision,
      warnings,
    };
  }

  evaluateDraft(
    profile: AssistantProfile,
    decision: ConversationDecision,
    draft: EngineResponseDraft,
  ): EngineResponseQuality {
    let score = 100;
    const findings: string[] = [];
    const risks: string[] = [];
    const recommendations: string[] = [];

    const questionCount = (draft.text.match(/\?/g) || []).length;
    if (questionCount > 1) {
      score -= 20;
      risks.push('Antwort stellt mehr als eine Rückfrage.');
      recommendations.push('Antwort auf eine klare nächste Frage reduzieren.');
    } else {
      findings.push('Antwort stellt maximal eine Rückfrage.');
    }

    if (decision.intent === 'support' && draft.shouldHandoff && draft.mode !== 'support_guidance') {
      score -= 25;
      risks.push('Supportfall wird zu früh in Übergabe statt Diagnose geführt.');
    }

    if (decision.intent === 'product_advice' && draft.shouldHandoff) {
      score -= 25;
      risks.push('Produktberatung würde zu früh als Kontaktübergabe behandelt.');
    }

    if (decision.intent === 'complaint' && !draft.shouldHandoff) {
      score -= 20;
      risks.push('Beschwerde bereitet keine menschliche Übergabe vor.');
    }

    if (decision.intent === 'unknown' && draft.mode !== 'clarification') {
      score -= 20;
      risks.push('Unklarer Bedarf wird nicht sauber geklärt.');
    }

    if (decision.intent === 'unknown' && !/(Fragen|Anfragen|Support|Option|Einstiegspunkt)/i.test(draft.text)) {
      score -= 15;
      risks.push('Unklarer Bedarf bietet keine verständlichen Optionen.');
      recommendations.push('Bei unklarem Bedarf 2-3 klare Auswahloptionen anbieten.');
    }

    if (!draft.text.trim() || draft.text.trim().length < 25) {
      score -= 40;
      risks.push('Antwort ist leer oder zu kurz.');
      recommendations.push('Antwort mit kurzer Einordnung und nächster Aktion formulieren.');
    }

    if (draft.text.length > 1200) {
      score -= 15;
      risks.push('Antwort ist sehr lang und potenziell unübersichtlich.');
      recommendations.push('Antwort kürzen und auf eine nächste Aktion fokussieren.');
    }

    if (profile.knowledgeMode === 'strict' && draft.usedKnowledge === false && draft.mode === 'knowledge_answer') {
      score -= 30;
      risks.push('Strict Knowledge Mode ohne Wissensgrundlage.');
      recommendations.push('Ohne Wissensbasis transparent bleiben oder Rückfrage stellen.');
    }

    if (draft.shouldShowSources && draft.usedKnowledgeSources.length === 0) {
      score -= 25;
      risks.push('Antwort behauptet Quellen, obwohl keine konkreten Quellen vorhanden sind.');
      recommendations.push('Quellen nur anzeigen, wenn konkrete Quellen vorhanden sind.');
    }

    if (/(garantiert|auf jeden fall|verbindlicher preis|100 ?%|garantie|sicher gelöst|sicher geloest)/i.test(draft.text)) {
      score -= 30;
      risks.push('Antwort enthält potenziell verbindliche Zusagen.');
      recommendations.push('Keine verbindlichen Preise, Garantien oder Lösungserfolge simulieren.');
    }

    if (decision.selectedAgentKey && draft.confidence >= 0.7) {
      findings.push(`Agent ${decision.selectedAgentKey} passt mit ausreichender Confidence.`);
    }

    const boundedScore = Math.max(0, Math.min(100, score));
    const status: EngineResponseQuality['status'] =
      boundedScore >= 80 ? 'good' : boundedScore >= 50 ? 'needs_review' : 'risky';

    return {
      status,
      score: boundedScore,
      findings,
      risks,
      recommendations,
    };
  }
}
