type PromptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const CONTACT_INTENT_PATTERN =
  /\b(kontakt|anfrage|angebot|termin|rueckruf|rückruf|telefonat|gespraech|gespräch|melden)\b/i;
const AFFIRMATION_PATTERN = /^(ja|jap|yes|bitte|gern|gerne|okay|ok|klingt gut|mach(en)? wir)\b/i;
const QUALIFIED_NEED_PATTERN =
  /\b(support|kunden\s*support|kundenservice|marketing|prozesse|automatisierung|mitarbeiter|entlasten|standardfragen|website|leads?|seo|google ads|kosten)\b/i;
const INDUSTRY_PATTERN =
  /\b(unternehmen|firma|agentur|shop|e-commerce|arzt|kanzlei|restaurant|hotel|handwerk|immobilien|praxis|beratung)\b/i;
const URGENCY_PATTERN = /\b(sofort|dringend|zeitnah|diese woche|heute|morgen|schnell)\b/i;

function compact(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function formatHistory(history: PromptMessage[]) {
  return history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'Nutzer' : 'Assistent'}: ${compact(message.content)}`)
    .join('\n');
}

function detectState(history: PromptMessage[]) {
  const userMessages = history.filter((message) => message.role === 'user');
  const assistantMessages = history.filter((message) => message.role === 'assistant');
  const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';
  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1]?.content || '';
  const wholeUserText = userMessages.map((message) => message.content).join('\n');

  const wantsContact =
    CONTACT_INTENT_PATTERN.test(wholeUserText) ||
    (AFFIRMATION_PATTERN.test(compact(latestUserMessage)) &&
      CONTACT_INTENT_PATTERN.test(latestAssistantMessage));
  const hasQualifiedNeed = QUALIFIED_NEED_PATTERN.test(wholeUserText);
  const hasIndustryContext = INDUSTRY_PATTERN.test(wholeUserText);
  const hasUrgencyContext = URGENCY_PATTERN.test(wholeUserText);

  if (wantsContact) {
    return {
      stage: 'contact-ready',
      instruction:
        'Der Nutzer ist kontaktbereit. Bestaetige kurz und leite direkt zur Kontaktaufnahme weiter. Stelle keine weitere allgemeine Rueckfrage und wiederhole keine Auswahlfrage.',
    };
  }

  if (hasQualifiedNeed && userMessages.length >= 2) {
    const missing = [];
    if (!hasIndustryContext) {
      missing.push('Branche oder Unternehmenskontext');
    }
    if (!hasUrgencyContext) {
      missing.push('Dringlichkeit oder Umfang');
    }

    return {
      stage: 'qualified',
      instruction:
        missing.length > 0
          ? `Der Bedarf ist weitgehend klar. Gib eine kurze Einordnung und stelle hoechstens eine gezielte Rueckfrage zu ${missing[0]}. Fuehre danach in Richtung Kontakt.`
          : 'Der Bedarf ist klar. Gib eine kurze, konkrete Einordnung und fuehre direkt in Richtung Kontakt oder Termin. Stelle keine weitere Qualifizierungsrunde mehr.',
    };
  }

  return {
    stage: 'clarify',
    instruction:
      'Der Einstieg ist noch zu allgemein. Stelle genau eine gezielte Qualifizierungsfrage zum Einsatzbereich, zum Problem oder zum konkreten Ziel. Fuehre noch nicht direkt auf Termin oder Anfrage.',
  };
}

export function buildConversationGuide(history: PromptMessage[]) {
  const normalizedHistory = history
    .map((message) => ({
      role: message.role,
      content: compact(message.content || ''),
    }))
    .filter((message) => message.content.length > 0);

  const state = detectState(normalizedHistory);
  const historyText = formatHistory(normalizedHistory);

  return `
Gesprächsphase: ${state.stage}
Gesprächsregel: ${state.instruction}

Letzte Nachrichten:
${historyText || '(kein Verlauf vorhanden)'}
`.trim();
}
