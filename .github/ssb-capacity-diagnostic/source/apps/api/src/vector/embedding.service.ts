import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { MaintenanceWork, maintenanceFetch } from '../maintenance/maintenance-runtime';

import { resolveEmbeddingConfig, supportsEmbeddingConfig, type ResolvedEmbeddingConfig } from './embedding-config';
export { DEFAULT_EMBEDDING_PROVIDER_KEY, DEFAULT_EMBEDDING_MODEL, resolveEmbeddingConfig, resolveEmbeddingModel, resolveEmbeddingProviderKey, type ResolvedEmbeddingConfig } from './embedding-config';
const OPENAI_EMBEDDING_BASE_URL = 'https://api.openai.com/v1';

export type EmbeddingTransportAuthorization = () => Promise<void>;

function isAllowedEmbeddingRequestUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'api.openai.com' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.pathname === '/v1/embeddings' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

@Injectable()
export class EmbeddingService {
  resolveConfig(): ResolvedEmbeddingConfig {
    return resolveEmbeddingConfig();
  }

  supportsResolvedConfig(config: ResolvedEmbeddingConfig) {
    return supportsEmbeddingConfig(config);
  }

  @MaintenanceWork('handler')
  async embedWithResolvedConfig(
    text: string,
    config: ResolvedEmbeddingConfig,
    authorizeTransport: EmbeddingTransportAuthorization,
    options: { signal?: AbortSignal } = {},
  ): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY?.trim() || '';
    const configuredBaseUrl = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, '') || OPENAI_EMBEDDING_BASE_URL;
    if (
      !this.supportsResolvedConfig(config) ||
      !text.trim() ||
      !apiKey ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(config.model) ||
      configuredBaseUrl !== OPENAI_EMBEDDING_BASE_URL ||
      typeof authorizeTransport !== 'function'
    ) {
      throw new Error('Invalid embedding provider configuration');
    }

    const client = new OpenAI({
      apiKey,
      baseURL: OPENAI_EMBEDDING_BASE_URL,
      maxRetries: 0,
      logLevel: 'off',
      timeout: 30_000,
      fetch: async (input, init) => {
        const requestUrl = input instanceof Request ? input.url : input.toString();
        if (!isAllowedEmbeddingRequestUrl(requestUrl)) {
          throw new Error('Embedding provider target rejected');
        }
        options.signal?.throwIfAborted();
        await authorizeTransport();
        options.signal?.throwIfAborted();
        return maintenanceFetch(input, { ...init, redirect: 'error' });
      },
    });

    const res = await client.embeddings.create({
      model: config.model,
      input: text,
      encoding_format: 'float',
    }, { signal: options.signal });
    const embedding = res.data[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
      throw new Error('Invalid embedding response');
    }
    return embedding;
  }
}
