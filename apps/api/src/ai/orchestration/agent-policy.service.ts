import { Injectable } from '@nestjs/common';

import {
  AgentCollectedFields,
  AgentDecision,
  AgentDecisionType,
  AgentPolicyContext,
} from './agent-decision.types';
import type { LocalServiceIntakeFlowConfig } from '../../site-modules/module-configs';

@Injectable()
export class AgentPolicyService {
  decide(context: AgentPolicyContext): AgentDecision {
    const text = normalizeText(context.message);
    const intakeFlow = getIntakeFlow(context);
    const collectedFields = this.collectFields(context);
    const missingContactFields = getMissingContactFields(collectedFields);
    const hasContact = Boolean(collectedFields.email || collectedFields.phone);
    const leadEnabled = isLeadEnabled(context);

    if (hasSensitiveDataInput(text)) {
      return this.buildDecision({
        type: 'ask_followup',
        confidence: 0.91,
        reason: 'User entered or offered sensitive credentials, payment data, or identity data.',
        message:
          'Bitte geben Sie hier keine Passwörter, MFA-Codes, Zahlungsdaten oder Ausweisdaten ein. Beschreiben Sie nur das Problem ohne solche Daten; falls nötig, übernimmt ein Mitarbeiter.',
        collectedFields,
        requiredFields: [],
        suggestedTools: [],
        nextAction: 'continue_answer',
      });
    }

    if (hasGreetingIntent(text)) {
      return this.buildDecision({
        type: 'answer',
        confidence: 0.86,
        reason: 'User greeted the assistant without a business or contact intent.',
        message: intakeFlow
          ? 'Guten Tag, ich unterstuetze Sie bei Fragen zum Einsatz, zu Kosten, Rueckruf oder Notdienst. Wobei kann ich Ihnen helfen?'
          : 'Hi, ich helfe dir bei Fragen zu Websites, KI-Automatisierung, Support-Systemen oder individuellen Softwareloesungen. Wobei kann ich dich unterstuetzen?',
        collectedFields,
        requiredFields: [],
        suggestedTools: [],
        nextAction: 'continue_answer',
      });
    }

    if (hasRecoveryIntent(text) || hasRefusalIntent(text)) {
      return this.buildDecision({
        type: 'ask_followup',
        confidence: 0.84,
        reason: 'User is confused, annoyed, or declined contact capture.',
        message: intakeFlow
          ? 'Entschuldigung, ich habe zu frueh nach Kontaktdaten gefragt. Ich kann Ihnen auch erst einmal normal weiterhelfen. Geht es um einen akuten Notfall, eine Kostenfrage oder eine allgemeine Anfrage?'
          : 'Du hast recht, ich frage gerade zu frueh nach Kontaktdaten. Ich kann dir auch erst einmal normal weiterhelfen. Geht es bei dir eher um Website, KI-Automatisierung, Support oder Beratung?',
        collectedFields,
        requiredFields: ['intent'],
        suggestedTools: [],
        nextAction: 'ask_for_missing_context',
      });
    }

    if (hasExplicitToolIntent(text)) {
      return this.buildDecision({
        type: 'trigger_tool',
        confidence: 0.82,
        reason: 'User explicitly requested an automated action or integration.',
        message: 'Ich kann eine passende Aktion vorbereiten. Welche Daten sollen uebergeben werden?',
        collectedFields,
        requiredFields: ['tool_payload'],
        suggestedTools: ['push_webhook'],
        nextAction: 'prepare_tool_execution',
      });
    }

    if (hasHandoffIntent(text)) {
      return this.buildDecision({
        type: 'handoff',
        confidence: 0.84,
        reason: 'User asked for a human or the situation likely needs human takeover.',
        message: hasContact
          ? 'Ich gebe das an einen Menschen weiter und nehme deine Anfrage auf.'
          : 'Das sollte sich ein Mensch ansehen. Wie koennen wir dich am besten erreichen?',
        collectedFields,
        requiredFields: hasContact ? [] : ['email', 'phone'],
        suggestedTools: hasContact ? ['schedule_contact'] : [],
        nextAction: hasContact ? 'recommend_human_handoff' : 'ask_for_contact_details',
      });
    }

    if (hasTicketIntent(text)) {
      const requiredFields = [
        ...(!collectedFields.concern ? ['description'] : []),
        ...(!hasContact ? ['email', 'phone'] : []),
      ];
      return this.buildDecision({
        type: 'create_ticket',
        confidence: context.moduleContext.propertyTicketingEnabled ? 0.88 : 0.72,
        reason: 'User describes a support, damage, order, or ticket case.',
        message: requiredFields.length > 0
          ? 'Ich kann daraus einen Support-Fall vorbereiten. Was ist passiert und wie koennen wir dich erreichen?'
          : 'Ich kann daraus einen Support-Fall vorbereiten.',
        collectedFields,
        requiredFields,
        suggestedTools: ['create_ticket'],
        nextAction: 'prepare_ticket',
      });
    }

    if (hasScheduleIntent(text, intakeFlow)) {
      return this.buildDecision({
        type: 'schedule_contact',
        confidence: hasContact ? 0.9 : 0.8,
        reason: 'User requested appointment, callback, demo, or direct contact.',
        message: context.siteConfig.scheduleUrl && hasContact
          ? intakeFlow
            ? `Perfekt. Hier koennen Sie direkt einen Termin buchen: ${context.siteConfig.scheduleUrl}`
            : `Perfekt. Hier kannst du direkt einen Termin buchen: ${context.siteConfig.scheduleUrl}`
          : intakeFlow
            ? 'Perfekt. Wie koennen wir Sie am besten erreichen - per E-Mail oder Telefon?'
            : 'Perfekt. Wie koennen wir dich am besten erreichen - per E-Mail oder Telefon?',
        collectedFields,
        requiredFields: hasContact ? [] : ['email', 'phone'],
        suggestedTools: hasContact ? ['schedule_contact'] : [],
        nextAction: hasContact ? 'prepare_schedule_contact' : 'ask_for_contact_details',
      });
    }

    if (hasServiceKnowledgeQuestion(text, intakeFlow)) {
      return this.buildDecision({
        type: 'answer',
        confidence: 0.78,
        reason: 'User asked an informational service question that should be answered from knowledge first.',
        message: '',
        collectedFields,
        requiredFields: [],
        suggestedTools: ['query_knowledge'],
        nextAction: 'continue_answer',
      });
    }

    if (hasLeadIntent(text, intakeFlow) || context.memory.pendingLeadStatus === 'pending') {
      const requiredFields = [
        ...(!collectedFields.concern ? ['concern'] : []),
        ...(!collectedFields.name ? ['name'] : []),
        ...(!hasContact ? ['email', 'phone'] : []),
      ];
      const complete = requiredFields.length === 0;
      return this.buildDecision({
        type: complete ? 'capture_lead' : 'ask_followup',
        confidence: complete ? 0.88 : 0.76,
        reason: complete
          ? 'User provided enough contact and need information for lead capture.'
          : 'User has commercial or consultation intent, but required lead fields are missing.',
        message: complete
          ? intakeFlow
            ? 'Perfekt, ich habe Ihre Anfrage aufgenommen.'
            : 'Perfekt, ich habe deine Anfrage aufgenommen.'
          : buildLeadFollowup(requiredFields, intakeFlow),
        collectedFields,
        requiredFields,
        suggestedTools: complete && leadEnabled ? ['capture_lead'] : [],
        nextAction: complete ? 'prepare_lead_capture' : 'ask_for_contact_details',
      });
    }

    if (hasServiceRecommendationIntent(text)) {
      return this.buildDecision({
        type: 'recommend_service',
        confidence: 0.73,
        reason: 'User describes a business problem that maps to a service recommendation.',
        message: 'Dazu passt wahrscheinlich eine Beratung mit Automatisierung und Wissensbot. Ich ordne dir das kurz ein.',
        collectedFields,
        requiredFields: [],
        suggestedTools: ['query_knowledge'],
        nextAction: 'recommend_service',
      });
    }

    if (hasLowConfidence(text)) {
      return this.buildDecision({
        type: 'ask_followup',
        confidence: 0.42,
        reason: 'Intent is underspecified.',
        message: 'Damit ich es richtig einordne: Geht es um Support, mehr Anfragen, Produkte oder einen konkreten Fall?',
        collectedFields,
        requiredFields: ['intent'],
        suggestedTools: [],
        nextAction: 'ask_for_missing_context',
      });
    }

    return this.buildDecision({
      type: 'answer',
      confidence: 0.62,
      reason: 'No clear action intent detected; continue with normal answer flow.',
      message: '',
      collectedFields,
      requiredFields: [],
      suggestedTools: ['query_knowledge'],
      nextAction: 'continue_answer',
    });
  }

  private collectFields(context: AgentPolicyContext): AgentCollectedFields {
    const extracted = {
      name: context.memory.knownName,
      email: context.memory.knownEmail,
      phone: context.memory.knownPhone,
      company: context.memory.company,
      industry: context.memory.industry,
      concern: context.memory.concern,
      companyNeed: context.memory.concern,
      urgency: context.memory.urgency || 'unknown',
      preferredContact: context.memory.preferredContact || 'unknown',
    } satisfies AgentCollectedFields;

    return Object.fromEntries(
      Object.entries(extracted).filter(([, value]) => value !== undefined && value !== ''),
    ) as AgentCollectedFields;
  }

  private buildDecision(input: {
    type: AgentDecisionType;
    confidence: number;
    reason: string;
    message: string;
    collectedFields: AgentCollectedFields;
    requiredFields: string[];
    suggestedTools: string[];
    nextAction: AgentDecision['nextAction'];
  }): AgentDecision {
    return {
      type: input.type,
      confidence: clampConfidence(input.confidence),
      reason: input.reason,
      message: input.message,
      metadata: {
        rule: input.type,
        hasContact: Boolean(input.collectedFields.email || input.collectedFields.phone),
        hasConcern: Boolean(input.collectedFields.concern || input.collectedFields.companyNeed),
      },
      suggestedTools: input.suggestedTools,
      requiredFields: input.requiredFields,
      collectedFields: input.collectedFields,
      nextAction: input.nextAction,
    };
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFKC').trim();
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function isLeadEnabled(context: AgentPolicyContext) {
  return (
    context.moduleContext.leadSalesEnabled ||
    context.siteConfig.setupGoal === 'lead_capture' ||
    context.siteConfig.setupGoal === 'appointments' ||
    context.siteConfig.leadCaptureEnabled !== false
  );
}

function getIntakeFlow(context: AgentPolicyContext) {
  return context.moduleContext.intakeFlow || context.siteConfig.intakeFlow;
}

function getMissingContactFields(fields: AgentCollectedFields) {
  const missing: string[] = [];
  if (!fields.email && !fields.phone) {
    missing.push('email', 'phone');
  }
  return missing;
}

function hasLeadIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(beratung|beraten|angebot|kostet|kosten|preis|preise|interesse|interessiere|kundenanfrage|kundengewinnung|mehr kunden|demo|erstgespraech|erstgespräch|ki für mein unternehmen|ki fuer mein unternehmen)\b/i.test(text) ||
    matchesKeyword(text, [
      ...(intakeFlow?.genericLocalServiceKeywords || []),
      ...(intakeFlow?.problemKeywords || []),
      ...(intakeFlow?.callbackKeywords || []),
    ])
  );
}

function hasScheduleIntent(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(termin|meeting|kalender|buchen|buchung|telefonat|rueckruf|rückruf|zurueckrufen|zurückrufen|zurueckgerufen|zurückgerufen|anrufen|demo|sprechen|kontaktaufnahme|erstgespraech|erstgespräch)\b/i.test(text) ||
    matchesKeyword(text, intakeFlow?.callbackKeywords || [])
  );
}

function hasServiceKnowledgeQuestion(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  return (
    /\b(einsatzgebiet|kommen sie auch|wohne in|fahrtkosten|anfahrt)\b/i.test(text) ||
    matchesKeyword(text, intakeFlow?.pricingKeywords || []) ||
    (/\b(kostet|kosten|preis|preise)\b/i.test(text) &&
      matchesKeyword(text, [
        ...(intakeFlow?.problemKeywords || []),
        ...(intakeFlow?.genericLocalServiceKeywords || []),
      ]))
  );
}

function hasTicketIntent(text: string) {
  return /\b(ticket|supportfall|problem mit|bestellung|schaden|schadensmeldung|reparatur|defekt|stoerung|störung|mieter|hausverwaltung|beschwerde|passwort|kennwort|mfa|2fa|vpn|wlan|wifi|netzwerk|outlook|e-mail|email|drucker|printer|geraet|gerät|laptop|pc|software|zugriff|berechtigung|login|anmeldung)\b/i.test(text);
}

function hasSensitiveDataInput(text: string) {
  return /\b((passwort|kennwort)\s*(ist|lautet|:)|(?:mfa|2fa|tan|pin)(?:\s*code)?\s*(ist|lautet|:)|kreditkarte|kartennummer|cvv|cvc|iban|ausweisnummer|personalausweis|reisepass|zahlungsdaten)\b/i.test(text);
}

function hasHandoffIntent(text: string) {
  return /\b(mensch|mitarbeiter|berater|support sprechen|jemand echten|eskalieren|chef|unzufrieden|beschweren|sicherheitsvorfall|phishing|malware|virus|ransomware|datenverlust|serverausfall|systemausfall|netzwerkausfall|komplett down|mfa gesperrt|2fa gesperrt|konto gesperrt|login blockiert)\b/i.test(text);
}

function hasServiceRecommendationIntent(text: string) {
  return /\b(support automatisierung|support-automatisierung|kunden stellen immer dieselben fragen|prozesse automatisieren|ki fuer|ki für|produkt empfehlen|service empfehlen|was passt)\b/i.test(text);
}

function hasExplicitToolIntent(text: string) {
  return /\b(webhook|crm|tool starten|aktion ausloesen|aktion auslösen|integration ausloesen|integration auslösen)\b/i.test(text);
}

function hasLowConfidence(text: string) {
  return text.length > 0 && text.length < 12 && !/\b(ja|nein|ok|okay|termin|support|angebot)\b/i.test(text);
}

function normalizeKeyword(value: string) {
  return value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keywords: string[]) {
  const normalized = normalizeKeyword(text);
  return keywords.some((keyword) => {
    const candidate = normalizeKeyword(keyword);
    if (!candidate) {
      return false;
    }
    return candidate.includes(' ')
      ? normalized.includes(candidate)
      : new RegExp(`\\b${escapeRegExp(candidate)}\\b`, 'i').test(normalized);
  });
}

function hasGreetingIntent(text: string) {
  const normalized = text.replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return /^(h+a+l+o+|hsallo|hi+|hey+|guten tag|servus|moin|moinsen|tach|hello)$/i.test(normalized);
}

function hasRecoveryIntent(text: string) {
  return /\b(was soll das|warum fragst du|warum|hä|hae|ich verstehe nicht|verstehe ich nicht|du wiederholst dich|wiederholst dich|nerv nicht|nervt|komisch|quatsch|unsinn)\b/i.test(text);
}

function hasRefusalIntent(text: string) {
  return /\b(nein|nope|kein interesse|keine interesse|stop|stopp|lass das|nicht kontaktieren|keine daten|will ich nicht|möchte ich nicht|moechte ich nicht)\b/i.test(text);
}

function buildLeadFollowup(requiredFields: string[], intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (requiredFields.includes('concern')) {
    return 'Klar. Worum geht es genau?';
  }
  if (requiredFields.includes('name')) {
    return intakeFlow ? 'Wie ist Ihr Name?' : 'Wie heißt du?';
  }
  if (requiredFields.includes('email') || requiredFields.includes('phone')) {
    return intakeFlow
      ? 'Wie koennen wir Sie am besten erreichen - per E-Mail oder Telefon?'
      : 'Wie koennen wir dich am besten erreichen - per E-Mail oder Telefon?';
  }
  return 'Welche Information fehlt noch, damit ich das sauber aufnehmen kann?';
}
