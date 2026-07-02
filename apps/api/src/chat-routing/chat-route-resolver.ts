import { ChatRouteContext, ChatRouteDecision } from './chat-route-types';
import {
  normalizeEcommerceProductAdvisorModuleConfig,
  normalizeItSupportModuleConfig,
  normalizeLeadSalesModuleConfig,
  normalizePropertyTicketingModuleConfig,
} from '../site-modules/module-configs';
import type { LocalServiceIntakeFlowConfig } from '../site-modules/module-configs';
import { buildItSupportAnswerGuide } from '../modules/it-support/it-support-flow';

const ECOMMERCE_PATTERN =
  /\b(shop|shopify|produkt|produkte|artikel|kaufen|bestellen|bestellung|kollektion|variante|groesse|größe|farbe|lieferung|versand|retoure|retouren|rueckgabe|rückgabe|umtausch|preis|preise|kostet|verfuegbar|verfügbar|verfuegbarkeit|verfügbarkeit|lager)\b/i;
const PROPERTY_PATTERN =
  /\b(mieter|wohnung|schaden|wasserschaden|reparatur|heizung|wasser|leckt|leck|ticket|stoerung|störung|hausverwaltung|defekt|passwort|kennwort|mfa|2fa|vpn|wlan|wifi|netzwerk|outlook|e-mail|email|drucker|printer|geraet|gerät|laptop|pc|software|zugriff|berechtigung|login|anmeldung|server|systemausfall|datenverlust|sicherheitsvorfall|phishing|malware|virus|ransomware)\b/i;
const IT_SUPPORT_PATTERN =
  /\b(passwort|kennwort|mfa|2fa|vpn|wlan|wifi|netzwerk|outlook|e-mail|email|drucker|printer|gerät|geraet|laptop|pc|software|zugriff|berechtigung|login|anmeldung|server|systemausfall|datenverlust|sicherheitsvorfall|phishing|malware|virus|ransomware|konto gesperrt|login blockiert)\b/i;
const SALES_PATTERN =
  /\b(ki|support|marketing|prozess|prozesse|automatisierung|mitarbeiter|entlast|vertrieb|lead|kundenservice|beratung|kontakt|termin|angebot|anfrage|rueckruf|rückruf)\b/i;
const AFFIRMATION_PATTERN = /^(ja|jap|yes|bitte|gern|gerne|okay|ok|klingt gut|passt)\b/i;
const CONTACT_CTA_PATTERN = /\b(termin|anfrage|kontakt|rueckruf|rückruf|whatsapp|telefon)\b/i;

function compact(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function latestAssistantMessage(
  history: ChatRouteContext['history'],
) {
  return (history || [])
    .slice()
    .reverse()
    .find((entry) => entry.role === 'assistant')
    ?.content || '';
}

function hasModule(enabledModuleKeys: string[], key: string) {
  return enabledModuleKeys.includes(key);
}

function normalizeKeyword(value: string) {
  return compact(value).toLowerCase().normalize('NFKC');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeyword(text: string, keywords: string[] = []) {
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

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function isLocalServiceKey(value: unknown) {
  return ['local-service-first-contact', 'local-services', 'local-service'].includes(
    asString(value).toLowerCase().replace(/_/g, '-'),
  );
}

function isExplicitLocalServiceIntakeFlow(value: unknown) {
  const flow = asObject(value);
  if (Object.keys(flow).length === 0) {
    return false;
  }

  if (isLocalServiceKey(flow.templateKey) || isLocalServiceKey(flow.templateId) || isLocalServiceKey(flow.profileKey)) {
    return true;
  }

  const questionTexts = asObject(flow.questionTexts);
  const requiredFields = asStringArray(flow.requiredFields);
  const questionOrder = asStringArray(flow.questionOrder);
  const hasAddressQuestion = Boolean(asString(questionTexts.fullAddress) || asString(questionTexts.location));
  const hasLocalField =
    requiredFields.includes('fullAddress') ||
    requiredFields.includes('location') ||
    requiredFields.includes('urgency') ||
    requiredFields.includes('problem');
  const hasLocalOrder =
    questionOrder.includes('fullAddress') ||
    questionOrder.includes('location') ||
    questionOrder.includes('urgency') ||
    questionOrder.includes('problem');

  return Boolean(hasAddressQuestion && hasLocalField && hasLocalOrder);
}

function getLocalServiceKeywords(intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (!intakeFlow) {
    return [];
  }

  return [
    ...intakeFlow.genericLocalServiceKeywords,
    ...intakeFlow.problemKeywords,
    ...intakeFlow.callbackKeywords,
  ];
}

function isLocalServicePricingQuestion(text: string, intakeFlow?: LocalServiceIntakeFlowConfig) {
  if (!intakeFlow) {
    return false;
  }

  return (
    (matchesKeyword(text, intakeFlow.pricingKeywords) ||
      /\b(kostet|kosten|preis|preise|abrechnung|abrechnen)\b/i.test(text)) &&
    matchesKeyword(text, [
      ...intakeFlow.problemKeywords,
      ...intakeFlow.genericLocalServiceKeywords,
    ])
  );
}

export function resolveChatRoute(context: ChatRouteContext): ChatRouteDecision {
  const normalizedMessage = compact(context.message || '');
  const assistantText = compact(latestAssistantMessage(context.history));
  const rawLeadSalesConfig = asObject(context.moduleConfigs?.['lead-sales']);
  const leadSalesConfig = normalizeLeadSalesModuleConfig(rawLeadSalesConfig);
  const localServiceIntakeFlow = isExplicitLocalServiceIntakeFlow(rawLeadSalesConfig.intakeFlow)
    ? leadSalesConfig.intakeFlow
    : undefined;
  const ecommerceConfig = normalizeEcommerceProductAdvisorModuleConfig(
    context.moduleConfigs?.['ecommerce-product-advisor'],
  );
  const propertyConfig = normalizePropertyTicketingModuleConfig(
    context.moduleConfigs?.['property-ticketing'],
  );
  const itSupportConfig = normalizeItSupportModuleConfig(
    context.moduleConfigs?.['it-support'],
  );

  if (
    hasModule(context.enabledModuleKeys, 'it-support') &&
    IT_SUPPORT_PATTERN.test(normalizedMessage)
  ) {
    return {
      route: 'agent',
      reason: 'it_support_intent',
      moduleKey: 'it-support',
      agentKey: 'it-support-agent',
      guide: buildItSupportAnswerGuide({ config: itSupportConfig }),
      cta: {
        action: 'lead_capture',
        label: itSupportConfig.ctaLabel,
        description: itSupportConfig.ctaDescription,
      },
    };
  }

  if (
    hasModule(context.enabledModuleKeys, 'property-ticketing') &&
    PROPERTY_PATTERN.test(normalizedMessage)
  ) {
    const intakeInstruction =
      propertyConfig.intakeMode === 'ticket_system'
        ? 'Bereite die Informationen fuer eine spaetere Ticketanlage vor.'
        : 'Bereite die Informationen fuer eine strukturierte Weiterleitung per E-Mail oder internen Fallprozess vor.';
    const urgencyInstruction =
      propertyConfig.urgencyStyle === 'brief'
        ? 'Halte die Rueckfragen kurz und fokussiere dich auf das unmittelbar Kritische.'
        : 'Arbeite Problem, Ort, Dringlichkeit und Auswirkungen strukturiert ab.';

    return {
      route: 'agent',
      reason: 'property_ticket_intent',
      moduleKey: 'property-ticketing',
      agentKey: 'property-ticket-agent',
      guide: `Routing-Hinweis: Behandle diese Anfrage als Support-/Ticket-Fall. ${urgencyInstruction} ${propertyConfig.incidentInstruction} ${intakeInstruction} ${propertyConfig.handoffInstruction} Sicherheitsregeln: Frage niemals nach Passwoertern, MFA-Codes oder Admin-Zugangsdaten. Gib keine riskanten PowerShell-, Terminal- oder Registry-Befehle ohne verifizierte Wissensbasis. Bei Sicherheitsvorfall, Datenverlust, Login/MFA-Blockade, Server-/Netzwerkausfall oder fehlender Berechtigung klar an einen Menschen eskalieren.`,
      cta: {
        action: 'lead_capture',
        label: propertyConfig.ctaLabel,
        description: propertyConfig.ctaDescription,
      },
    };
  }

  if (
    hasModule(context.enabledModuleKeys, 'ecommerce-product-advisor') &&
    ECOMMERCE_PATTERN.test(normalizedMessage)
  ) {
    const styleInstruction =
      ecommerceConfig.recommendationStyle === 'direct'
        ? 'Antworte direkt, konkret und mit klaren Produktempfehlungen.'
        : 'Fuehre zunaechst kurz beratend durch Bedarf, Einsatz und passende Auswahl.';
    const catalogInstruction =
      ecommerceConfig.catalogMode === 'shopify_catalog'
        ? 'Nutze angebundene Shop- oder Katalogdaten, wenn sie verfuegbar sind.'
        : 'Nutze vorhandenes Wissen und verifizierbare Inhalte als Kataloggrundlage.';

    return {
      route: 'advisor',
      reason: 'ecommerce_product_intent',
      moduleKey: 'ecommerce-product-advisor',
      agentKey: 'ecommerce-product-advisor',
      guide: `Routing-Hinweis: Behandle diese Anfrage als Produkt- oder Shop-Beratung. ${styleInstruction} ${catalogInstruction} ${ecommerceConfig.productLinkInstruction} ${ecommerceConfig.fallbackInstruction}`,
      cta: {
        action: 'lead_capture',
        label: ecommerceConfig.ctaLabel,
        description: ecommerceConfig.ctaDescription,
      },
    };
  }

  if (
    hasModule(context.enabledModuleKeys, 'lead-sales') &&
    !isLocalServicePricingQuestion(normalizedMessage, localServiceIntakeFlow) &&
    (SALES_PATTERN.test(normalizedMessage) ||
      matchesKeyword(normalizedMessage, getLocalServiceKeywords(localServiceIntakeFlow)) ||
      (AFFIRMATION_PATTERN.test(normalizedMessage) && CONTACT_CTA_PATTERN.test(assistantText)))
  ) {
    return {
      route: 'hybrid',
      reason: 'lead_sales_intent',
      moduleKey: 'lead-sales',
      agentKey: 'lead-sales-agent',
      guide: `Routing-Hinweis: Behandle diese Anfrage als Beratungs- und Lead-Dialog. ${leadSalesConfig.qualificationFocus} ${leadSalesConfig.handoffInstruction}`,
      cta: {
        action: 'lead_capture',
        label: leadSalesConfig.ctaLabel,
        description: leadSalesConfig.ctaDescription,
      },
    };
  }

  return {
    route: 'faq',
    reason: 'default_faq',
    moduleKey: 'knowledge-faq',
    guide:
      'Routing-Hinweis: Beantworte die Anfrage im normalen FAQ-/Wissensmodus. Nutze Kontext, aber leite nur dann in Kontakt über, wenn der Bedarf konkret wird.',
  };
}
