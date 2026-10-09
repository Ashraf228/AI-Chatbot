// Configuration only: importing this module cannot construct an SDK/provider client.
export const DEFAULT_EMBEDDING_PROVIDER_KEY = 'openai';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
export type ResolvedEmbeddingConfig = { providerKey: string; model: string };

export function supportsEmbeddingConfig(config: ResolvedEmbeddingConfig) {
  return config.providerKey === DEFAULT_EMBEDDING_PROVIDER_KEY;
}

export function resolveEmbeddingProviderKey() {
  const value = (process.env.OPENAI_EMBED_PROVIDER || DEFAULT_EMBEDDING_PROVIDER_KEY).trim();
  return value || DEFAULT_EMBEDDING_PROVIDER_KEY;
}

export function resolveEmbeddingModel() {
  const value = (process.env.OPENAI_EMBED_MODEL || DEFAULT_EMBEDDING_MODEL).trim();
  return value || DEFAULT_EMBEDDING_MODEL;
}

export function resolveEmbeddingConfig(): ResolvedEmbeddingConfig {
  return { providerKey: resolveEmbeddingProviderKey(), model: resolveEmbeddingModel() };
}
