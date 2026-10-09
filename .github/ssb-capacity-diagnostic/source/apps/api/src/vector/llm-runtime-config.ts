export const LLM_PROVIDER_KEY = 'openai';
export const OPENAI_LLM_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export type LlmRuntimeConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

// Configuration only: grant administration must never construct an SDK client.
// The returned credential is internal and must not be logged or projected.
export function resolveLlmRuntimeConfig(): LlmRuntimeConfig | null {
  const model = (process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
  const configuredBaseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, '') || OPENAI_LLM_BASE_URL;
  if (!apiKey || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)
    || configuredBaseUrl !== OPENAI_LLM_BASE_URL) return null;
  return { apiKey, baseUrl: OPENAI_LLM_BASE_URL, model };
}
