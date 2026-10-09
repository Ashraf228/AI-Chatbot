export type LlmUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  status: 'confirmed' | 'missing' | 'incomplete';
};

export type LlmUsageMeasurement = {
  callId: string;
  tenantId: string;
  siteId: string;
  provider: 'openai';
  model: string;
  startedAt: string;
  usage: LlmUsage;
  outcome: 'success' | 'error' | 'aborted';
  latencyMs: number;
};

export function readProviderUsage(value: unknown): LlmUsage {
  if (value == null) return { inputTokens: null, outputTokens: null, totalTokens: null, status: 'missing' };
  const raw = value as Record<string, unknown>;
  const token = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 2147483647 ? v : null;
  const inputTokens = token(raw.prompt_tokens);
  const outputTokens = token(raw.completion_tokens);
  const totalTokens = token(raw.total_tokens);
  const confirmed = inputTokens !== null && outputTokens !== null && totalTokens !== null && inputTokens + outputTokens === totalTokens;
  // Detail categories (cached/reasoning/audio tokens) are already included in these totals.
  return { inputTokens, outputTokens, totalTokens, status: confirmed ? 'confirmed' : 'incomplete' };
}
