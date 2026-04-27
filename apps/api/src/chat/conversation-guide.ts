import { ConversationFlowConfig, resolveConversationFlow } from './flow-builder';

type PromptMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};
const AFFIRMATION_PATTERN = /^(ja|jap|yes|bitte|gern|gerne|okay|ok|klingt gut|mach(en)? wir)\b/i;

function compact(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function formatHistory(history: PromptMessage[]) {
  return history
    .slice(-6)
    .map((message) => `${message.role === 'user' ? 'Nutzer' : 'Assistent'}: ${compact(message.content)}`)
    .join('\n');
}

function detectState(history: PromptMessage[], flow?: ConversationFlowConfig) {
  const resolvedFlow = resolveConversationFlow(flow);
  const userMessages = history.filter((message) => message.role === 'user');
  const assistantMessages = history.filter((message) => message.role === 'assistant');
  const latestUserMessage = userMessages[userMessages.length - 1]?.content || '';
  const latestAssistantMessage = assistantMessages[assistantMessages.length - 1]?.content || '';
  const wholeUserText = userMessages.map((message) => message.content).join('\n');

  const wantsContact =
    resolvedFlow.triggerPatterns.contactIntent.test(wholeUserText) ||
    (AFFIRMATION_PATTERN.test(compact(latestUserMessage)) &&
      resolvedFlow.triggerPatterns.contactIntent.test(latestAssistantMessage));
  const hasQualifiedNeed = resolvedFlow.triggerPatterns.qualifiedNeed.test(wholeUserText);
  const hasIndustryContext = resolvedFlow.triggerPatterns.industry.test(wholeUserText);
  const hasUrgencyContext = resolvedFlow.triggerPatterns.urgency.test(wholeUserText);

  if (wantsContact) {
    return {
      stage: 'contact-ready',
      instruction: resolvedFlow.instructions.contactReady,
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
          ? missing[0] === 'Branche oder Unternehmenskontext'
            ? `${resolvedFlow.instructions.qualifiedMissingIndustry} Nutze dafuer bevorzugt diese Rueckfrage: "${resolvedFlow.questions.industry}"`
            : `${resolvedFlow.instructions.qualifiedMissingUrgency} Nutze dafuer bevorzugt diese Rueckfrage: "${resolvedFlow.questions.urgency}"`
          : resolvedFlow.instructions.qualifiedReady,
    };
  }

  return {
    stage: 'clarify',
    instruction: `${resolvedFlow.instructions.clarify} Nutze dafuer bevorzugt diese Rueckfrage: "${resolvedFlow.questions.opening}"`,
  };
}

export function buildConversationGuide(history: PromptMessage[], flow?: ConversationFlowConfig) {
  const normalizedHistory = history
    .map((message) => ({
      role: message.role,
      content: compact(message.content || ''),
    }))
    .filter((message) => message.content.length > 0);

  const state = detectState(normalizedHistory, flow);
  const historyText = formatHistory(normalizedHistory);

  return `
Gesprächsphase: ${state.stage}
Gesprächsregel: ${state.instruction}

Letzte Nachrichten:
${historyText || '(kein Verlauf vorhanden)'}
`.trim();
}
