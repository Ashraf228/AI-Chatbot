import {
  DEFAULT_IT_SUPPORT_MODULE_CONFIG,
  DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
} from '../site-modules/module-configs';
import type { LocalServiceIntakeFlowConfig } from '../site-modules/module-configs';

export type SiteModulePatch = {
  key: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
};

export type BrandingDefaults = {
  brandColor: string;
  accentColor: string;
  fontFamily: 'system' | 'inter' | 'avenir' | 'georgia' | 'times' | 'trebuchet' | 'verdana' | 'monospace';
  botName?: string;
};

export type IndustryTemplate = {
  key: string;
  version: number;
  label: string;
  description?: string;
  setupGoal: 'lead_capture' | 'support' | 'product_advice' | 'appointments';
  botType?: string;
  welcomeMessage: string;
  systemPrompt: string;
  tone: 'professional' | 'friendly' | 'consultative';
  ctaText: string;
  launcherLabel?: string;
  recommendedQuestions: Record<string, string[]>;
  topTestQuestions: string[];
  reportKpis: string[];
  brandingDefaults: BrandingDefaults;
  conversationFlow?: LocalServiceIntakeFlowConfig;
  modules: SiteModulePatch[];
};

function baseModules(overrides: Partial<Record<string, SiteModulePatch>>) {
  const defaults: Record<string, SiteModulePatch> = {
    'lead-sales': { key: 'lead-sales', isEnabled: true },
    'knowledge-faq': { key: 'knowledge-faq', isEnabled: true },
    'ecommerce-product-advisor': { key: 'ecommerce-product-advisor', isEnabled: false },
    'property-ticketing': { key: 'property-ticketing', isEnabled: false },
    'it-support': { key: 'it-support', isEnabled: false },
    'reporting-insights': { key: 'reporting-insights', isEnabled: true },
  };

  return Object.entries(defaults).map(([key, value]) => overrides[key] ?? value);
}

const LOCAL_SERVICE_FIRST_CONTACT_FLOW: LocalServiceIntakeFlowConfig = {
  ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
  templateKey: 'local-service-first-contact',
  subIndustry: 'local_service',
  requiredFields: ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
  questionOrder: ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
  questionTexts: {
    ...DEFAULT_LOCAL_SERVICE_INTAKE_FLOW.questionTexts,
    problem: 'Was genau ist passiert?',
    location: 'Okay, wir kümmern uns darum. Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.',
    fullAddress: 'Okay, wir kümmern uns darum. Bitte nennen Sie uns die vollständige Einsatzadresse mit Straße, Hausnummer, PLZ und Ort.',
    urgency: 'Wie dringend ist es aktuell - Notfall, heute noch oder Terminwunsch?',
    phone: 'Unter welcher Telefonnummer kann das Unternehmen Sie zurückrufen?',
    name: 'Danke. Auf welchen Vor- und Nachnamen dürfen wir die Anfrage aufnehmen?',
    fullName: 'Danke. Auf welchen Vor- und Nachnamen dürfen wir die Anfrage aufnehmen?',
    callback: 'Gerne. Geht es um einen akuten Notfall oder um eine allgemeine Anfrage?',
  },
  pricingAnswerTemplate:
    'Die Kosten hängen vom Aufwand, dem betroffenen Problem und der Dringlichkeit ab. Eine genaue Einschätzung ist nach kurzer Problembeschreibung möglich.',
};

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  'local-service-first-contact': {
    key: 'local-service-first-contact',
    version: 1,
    label: 'Handwerker / Erstkontakt',
    description:
      'Erfasst Anliegen, Einsatzort, Dringlichkeit und Kontaktdaten und sendet die Anfrage an das Unternehmen.',
    setupGoal: 'lead_capture',
    botType: 'handwerker-first-contact',
    welcomeMessage: 'Guten Tag, wie kann ich Ihnen behilflich sein?',
    systemPrompt:
      'Führen Sie einen formellen Erstkontakt für Handwerker und lokale Dienstleister. Erfassen Sie nacheinander Problem, Dringlichkeit, vollständige Einsatzadresse, Vor- und Nachname sowie Telefonnummer. Verwenden Sie konsequent Sie-Ansprache. Vermeiden Sie Begriffe wie Projekt, Automatisierung oder Business-Prozess.',
    tone: 'professional',
    ctaText: 'Soforthilfe',
    launcherLabel: 'Soforthilfe',
    recommendedQuestions: {
      '/': [
        'Was kostet ein Einsatz?',
        'Ich brauche dringend Hilfe.',
        'Ich möchte zurückgerufen werden.',
      ],
    },
    topTestQuestions: [
      'Was kostet eine Rohrreinigung?',
      'Meine Toilette ist verstopft',
      'Ich möchte zurückgerufen werden',
    ],
    reportKpis: ['startedChats', 'leads', 'leadRate', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#b55400',
      accentColor: '#fff0d9',
      fontFamily: 'system',
      botName: 'Service-Assistent',
    },
    conversationFlow: LOCAL_SERVICE_FIRST_CONTACT_FLOW,
    modules: baseModules({
      'lead-sales': {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          primaryGoal: 'lead_capture',
          ctaLabel: 'Soforthilfe',
          ctaDescription: 'Wir nehmen Problem, Einsatzort, Dringlichkeit und Kontaktdaten auf.',
          qualificationFocus:
            'Kläre Problem, Dringlichkeit, vollständige Einsatzadresse, Vor- und Nachname sowie Telefonnummer in einer Frage nach der anderen.',
          handoffInstruction:
            'Frage erst nach Problem und Dringlichkeit, danach nach vollständiger Einsatzadresse, Vor- und Nachname und Telefonnummer. Schließe erst ab, wenn alle Pflichtfelder vorhanden sind.',
          intakeFlow: LOCAL_SERVICE_FIRST_CONTACT_FLOW,
        },
      },
      'knowledge-faq': { key: 'knowledge-faq', isEnabled: true },
      'reporting-insights': { key: 'reporting-insights', isEnabled: true },
      'ecommerce-product-advisor': { key: 'ecommerce-product-advisor', isEnabled: false },
      'property-ticketing': { key: 'property-ticketing', isEnabled: false },
    }),
  },
  'local-services': {
    key: 'local-services',
    version: 1,
    label: 'Lokaler Dienstleister',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Guten Tag, wie kann ich Ihnen behilflich sein?',
    systemPrompt:
      'Führen Sie einen formellen Erstkontakt für lokale Dienstleister. Erfassen Sie nacheinander Problem, Dringlichkeit, vollständige Einsatzadresse, Vor- und Nachname sowie Telefonnummer. Schließen Sie erst ab, wenn alle Pflichtfelder vorhanden sind.',
    tone: 'consultative',
    ctaText: 'Soforthilfe',
    launcherLabel: 'Soforthilfe',
    recommendedQuestions: {
      '/': [
        'Was ist gerade verstopft oder betroffen?',
        'Brauchen Sie schnelle Hilfe oder eine planbare Rückmeldung?',
        'In welchem Ort wird Hilfe benötigt?',
      ],
    },
    topTestQuestions: ['Mein Abfluss läuft nicht ab', 'Ich brauche heute Notdienst', 'Was kostet ein Einsatz?'],
    reportKpis: ['startedChats', 'leads', 'leadRate', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#b55400',
      accentColor: '#fff0d9',
      fontFamily: 'system',
      botName: 'Service-Assistent',
    },
    conversationFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
    modules: baseModules({
      'lead-sales': {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          primaryGoal: 'lead_capture',
          ctaLabel: 'Rückruf anfragen',
          ctaDescription: 'Wir nehmen den Einsatz kurz auf.',
          qualificationFocus:
            'Kläre Problem, Dringlichkeit, vollständige Einsatzadresse, Vor- und Nachname sowie Telefonnummer in einer Frage nach der anderen.',
          handoffInstruction:
            'Frage erst nach Problem und Dringlichkeit, danach nach vollständiger Einsatzadresse, Vor- und Nachname und Telefonnummer. Schließe erst ab, wenn alle Pflichtfelder vorhanden sind.',
          intakeFlow: DEFAULT_LOCAL_SERVICE_INTAKE_FLOW,
        },
      },
    }),
  },
  'ecommerce-shopify': {
    key: 'ecommerce-shopify',
    version: 1,
    label: 'E-Commerce / Shopify',
    setupGoal: 'product_advice',
    welcomeMessage: 'Hi! Ich helfe dir bei der Produktauswahl und den nächsten Schritten im Shop.',
    systemPrompt:
      'Berate Nutzer bei der Produktauswahl, stelle kurze Rückfragen zu Bedarf, Größe oder Budget und verweise transparent auf passende Produkte oder Kategorien.',
    tone: 'consultative',
    ctaText: 'Produkte ansehen',
    recommendedQuestions: {
      '/': [
        'Suchst du etwas Bestimmtes oder brauchst du erst eine Empfehlung?',
        'Soll ich dir passende Produkte nach Einsatzbereich oder Budget zeigen?',
      ],
    },
    topTestQuestions: ['Welche Produkte passen zu mir?', 'Gibt es passende Kategorien?', 'Kannst du mir Produkte verlinken?'],
    reportKpis: ['startedChats', 'productClicks', 'leads', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#1f7a4d',
      accentColor: '#e8f5ee',
      fontFamily: 'system',
      botName: 'Shop-Assistent',
    },
    modules: baseModules({
      'ecommerce-product-advisor': {
        key: 'ecommerce-product-advisor',
        isEnabled: true,
        config: {
          catalogMode: 'shopify_catalog',
          recommendationStyle: 'consultative',
        },
      },
    }),
  },
  'property-management': {
    key: 'property-management',
    version: 1,
    label: 'Immobilienverwaltung',
    setupGoal: 'support',
    welcomeMessage: 'Hi! Ich unterstütze bei Anliegen, Rückfragen und Schadensmeldungen.',
    systemPrompt:
      'Hilf bei Mieteranliegen, strukturiere Schadensmeldungen und leite bei klaren Fällen in die Fallaufnahme oder Weiterleitung über.',
    tone: 'professional',
    ctaText: 'Schadensmeldung aufnehmen',
    recommendedQuestions: {
      '/': [
        'Geht es um eine allgemeine Frage oder um einen konkreten Schaden?',
        'Soll ich zuerst das Anliegen klären oder direkt die Schadensmeldung aufnehmen?',
      ],
    },
    topTestQuestions: ['Ich habe einen Wasserschaden, was tun?', 'Wie melde ich einen Schaden?', 'Wer ist mein Ansprechpartner?'],
    reportKpis: ['startedChats', 'tickets', 'handoffs', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#1f4f73',
      accentColor: '#e9f2f8',
      fontFamily: 'system',
      botName: 'Mieter-Assistent',
    },
    modules: baseModules({
      'lead-sales': { key: 'lead-sales', isEnabled: false },
      'property-ticketing': {
        key: 'property-ticketing',
        isEnabled: true,
        config: {
          intakeMode: 'email_handoff',
          urgencyStyle: 'structured',
        },
      },
    }),
  },
  'it-support': {
    key: 'it-support',
    version: 1,
    label: 'IT-Support',
    setupGoal: 'support',
    welcomeMessage: 'Guten Tag. Ich helfe bei IT-Support-Fragen und der ersten Einordnung des Problems.',
    systemPrompt:
      'Sie sind ein First-Level-Support-Assistent für IT-Support. Beantworten Sie zunächst sichere Standardfragen aus Wissensbasis oder verifizierten Inhalten. Fragen Sie niemals nach Passwörtern, MFA-Codes, API-Keys oder Admin-Zugangsdaten. Bieten Sie bei größeren Problemen ein Support-Ticket an. Eskalieren Sie Sicherheitsvorfälle, Datenverlust, Komplettausfälle, Kontoübernahmen und unklare Risiken an einen Menschen.',
    tone: 'professional',
    ctaText: 'Support-Ticket öffnen',
    recommendedQuestions: {
      '/': [
        'Mein VPN verbindet nicht.',
        'Outlook sendet keine E-Mails.',
        'Ich möchte ein Support-Ticket öffnen.',
      ],
    },
    topTestQuestions: [
      'Mein VPN verbindet nicht',
      'Wie setze ich mein Passwort zurück?',
      'Wir haben eine Phishing-Mail erhalten',
    ],
    reportKpis: [
      'startedChats',
      'resolvedByKnowledge',
      'tickets',
      'handoffs',
      'topQuestions',
    ],
    brandingDefaults: {
      brandColor: '#2563eb',
      accentColor: '#e0ecff',
      fontFamily: 'system',
      botName: 'Support-Assistent',
    },
    modules: baseModules({
      'lead-sales': { key: 'lead-sales', isEnabled: false },
      'knowledge-faq': { key: 'knowledge-faq', isEnabled: true },
      'it-support': {
        key: 'it-support',
        isEnabled: true,
        config: DEFAULT_IT_SUPPORT_MODULE_CONFIG,
      },
      'property-ticketing': { key: 'property-ticketing', isEnabled: false },
      'ecommerce-product-advisor': { key: 'ecommerce-product-advisor', isEnabled: false },
      'reporting-insights': { key: 'reporting-insights', isEnabled: true },
    }),
  },
  'medical-practice': {
    key: 'medical-practice',
    version: 1,
    label: 'Arztpraxis',
    setupGoal: 'appointments',
    welcomeMessage: 'Hi! Ich helfe bei allgemeinen Fragen und der Vorbereitung von Terminanfragen.',
    systemPrompt:
      'Beantworte allgemeine Praxisfragen knapp, weise bei sensiblen Themen transparent auf direkte Kontaktwege hin und führe bei passenden Fällen Richtung Terminanfrage.',
    tone: 'professional',
    ctaText: 'Terminanfrage vorbereiten',
    recommendedQuestions: {
      '/': [
        'Geht es um allgemeine Informationen oder um eine Terminanfrage?',
        'Soll ich dir zuerst mit einer Frage helfen oder direkt die Terminanfrage vorbereiten?',
      ],
    },
    topTestQuestions: ['Wie kann ich einen Termin vereinbaren?', 'Welche Öffnungszeiten habt ihr?', 'Was soll ich bei Beschwerden tun?'],
    reportKpis: ['startedChats', 'appointmentIntents', 'leads', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#0f766e',
      accentColor: '#ddf7f4',
      fontFamily: 'system',
      botName: 'Praxis-Assistent',
    },
    modules: baseModules({
      'lead-sales': {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          primaryGoal: 'appointment',
        },
      },
    }),
  },
  'fitness-studio': {
    key: 'fitness-studio',
    version: 1,
    label: 'Fitnessstudio',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Hi! Ich helfe dir bei Fragen zu Training, Mitgliedschaft und dem nächsten Schritt.',
    systemPrompt:
      'Führe Interessenten kurz durch Angebote, Ziele und Mitgliedschaftsfragen und leite sichtbar in Probetraining oder Kontaktanfrage.',
    tone: 'friendly',
    ctaText: 'Probetraining anfragen',
    recommendedQuestions: {
      '/': [
        'Geht es um Mitgliedschaft, Probetraining oder eine allgemeine Frage?',
        'Soll ich dir zuerst passende Optionen zeigen oder direkt den nächsten Schritt vorbereiten?',
      ],
    },
    topTestQuestions: ['Gibt es ein Probetraining?', 'Welche Mitgliedschaften gibt es?', 'Was passt zu meinem Ziel?'],
    reportKpis: ['startedChats', 'leads', 'leadRate', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#111827',
      accentColor: '#f3f4f6',
      fontFamily: 'system',
      botName: 'Fitness-Assistent',
    },
    modules: baseModules({}),
  },
  'cleaning-trades': {
    key: 'cleaning-trades',
    version: 1,
    label: 'Reinigung / Handwerk',
    setupGoal: 'lead_capture',
    welcomeMessage: 'Hi! Ich helfe dir bei der ersten Einordnung deiner Anfrage und dem nächsten Schritt.',
    systemPrompt:
      'Kläre Einsatzort, Anliegen und Dringlichkeit, fasse knapp zusammen und leite dann Richtung Kontakt oder Rückruf.',
    tone: 'consultative',
    ctaText: 'Anfrage starten',
    recommendedQuestions: {
      '/': [
        'Geht es um eine neue Anfrage, ein laufendes Projekt oder eine Rückfrage?',
        'Soll ich zuerst das Anliegen und den Einsatzort eingrenzen?',
      ],
    },
    topTestQuestions: ['Ich brauche ein Angebot, was braucht ihr?', 'Wie schnell könnt ihr helfen?', 'Welche Leistungen bietet ihr an?'],
    reportKpis: ['startedChats', 'leads', 'leadRate', 'topQuestions'],
    brandingDefaults: {
      brandColor: '#0f766e',
      accentColor: '#ddf7f4',
      fontFamily: 'system',
      botName: 'Anfrage-Assistent',
    },
    modules: baseModules({}),
  },
};

export function listIndustryTemplates() {
  return Object.values(INDUSTRY_TEMPLATES);
}

export function getIndustryTemplate(key: string) {
  return INDUSTRY_TEMPLATES[key] || null;
}
