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
  const signals = {
    contactIntent: resolvedFlow.triggerPatterns.contactIntent.test(wholeUserText),
    qualifiedNeed: resolvedFlow.triggerPatterns.qualifiedNeed.test(wholeUserText),
    industry: resolvedFlow.triggerPatterns.industry.test(wholeUserText),
    urgency: resolvedFlow.triggerPatterns.urgency.test(wholeUserText),
    affirmedContactCta:
      AFFIRMATION_PATTERN.test(compact(latestUserMessage)) &&
      resolvedFlow.triggerPatterns.contactIntent.test(latestAssistantMessage),
  };

  const matchedState =
    resolvedFlow.states.find((state) => {
      const requiresSatisfied = state.requires.every((signal) => signals[signal]);
      const requiresAnySatisfied =
        state.requiresAny.length === 0 || state.requiresAny.some((signal) => signals[signal]);
      const forbidsSatisfied = state.forbids.every((signal) => !signals[signal]);
      const textSatisfied = !state.matchPattern || state.matchPattern.test(wholeUserText);

      return requiresSatisfied && requiresAnySatisfied && forbidsSatisfied && textSatisfied;
    }) || resolvedFlow.states[resolvedFlow.states.length - 1];

  const preferredQuestion = matchedState?.preferredQuestion?.trim();

  return {
    stage: matchedState?.id || 'clarify',
    instruction:
      preferredQuestion && preferredQuestion.length > 0
        ? `${matchedState.instruction} Nutze dafuer bevorzugt diese Rueckfrage: "${preferredQuestion}"`
        : matchedState.instruction,
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
