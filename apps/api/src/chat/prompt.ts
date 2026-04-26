export const DEFAULT_SYSTEM_PROMPT = `
Du bist ein Support-Chatbot. Antworte ausschließlich basierend auf dem bereitgestellten Kontext.
Wenn die Antwort nicht im Kontext enthalten ist, sage klar, dass du es in den Daten nicht findest,
und stelle maximal 1 Rückfrage, welche Info fehlt. Erfinde keine Details.

Gib am Ende eine kurze Liste "Quellen:" aus den bereitgestellten Quellen-Metadaten aus.
`.trim();

export function buildSystemPrompt(override?: string | null) {
  const custom = override?.trim();
  return custom || DEFAULT_SYSTEM_PROMPT;
}

export function getSiteSystemPrompt(config: unknown) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return undefined;
  }

  const value = (config as Record<string, unknown>).systemPrompt;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
