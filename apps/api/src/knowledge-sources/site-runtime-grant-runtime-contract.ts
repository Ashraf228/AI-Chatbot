import type { ProviderEmbeddingEnvironment } from './provider-embedding-gate';

export type SiteRuntimeGrantRuntimeContract = {
  environment: ProviderEmbeddingEnvironment;
  providerKey: string;
  model: string;
  supported: boolean;
};

export type ResolvedRuntimeEmbeddingConfig = {
  providerKey: string;
  model: string;
};

/**
 * This is configuration resolution only. It never constructs an embedding client
 * or calls a provider, so grant administration cannot activate provider traffic.
 */
export function buildSiteRuntimeGrantRuntimeContract(
  config: ResolvedRuntimeEmbeddingConfig,
  supported: boolean,
  nodeEnv = process.env.NODE_ENV,
): SiteRuntimeGrantRuntimeContract {
  return {
    environment: nodeEnv === 'production' ? 'production' : 'non_production',
    providerKey: config.providerKey,
    model: config.model,
    supported,
  };
}
