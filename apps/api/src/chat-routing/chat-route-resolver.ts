import { ChatRouteContext, ChatRouteDecision } from './chat-route-types';
import {
  normalizeEcommerceProductAdvisorModuleConfig,
  normalizeLeadSalesModuleConfig,
  normalizePropertyTicketingModuleConfig,
} from '../site-modules/module-configs';

const ECOMMERCE_PATTERN =
  /\b(shop|shopify|produkt|produkte|artikel|kaufen|bestellen|kollektion|variante|groesse|größe|farbe|lieferung)\b/i;
const PROPERTY_PATTERN =
  /\b(mieter|wohnung|schaden|reparatur|heizung|wasser|leckt|leck|ticket|stoerung|störung|hausverwaltung|defekt)\b/i;
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

export function resolveChatRoute(context: ChatRouteContext): ChatRouteDecision {
  const normalizedMessage = compact(context.message || '');
  const assistantText = compact(latestAssistantMessage(context.history));
  const leadSalesConfig = normalizeLeadSalesModuleConfig(context.moduleConfigs?.['lead-sales']);
  const ecommerceConfig = normalizeEcommerceProductAdvisorModuleConfig(
    context.moduleConfigs?.['ecommerce-product-advisor'],
  );
  const propertyConfig = normalizePropertyTicketingModuleConfig(
    context.moduleConfigs?.['property-ticketing'],
  );

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
      guide: `Routing-Hinweis: Behandle diese Anfrage als Immobilien-/Support-Fall. ${urgencyInstruction} ${propertyConfig.incidentInstruction} ${intakeInstruction} ${propertyConfig.handoffInstruction}`,
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
    (SALES_PATTERN.test(normalizedMessage) ||
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
