import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const DEFAULT_EMBEDDING_PROVIDER_KEY = 'openai';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_EMBEDDING_BASE_URL = 'https://api.openai.com/v1';

export type ResolvedEmbeddingConfig = {
  providerKey: string;
  model: string;
};

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

export function resolveEmbeddingProviderKey() {
  const value = (process.env.OPENAI_EMBED_PROVIDER || DEFAULT_EMBEDDING_PROVIDER_KEY).trim();
  return value || DEFAULT_EMBEDDING_PROVIDER_KEY;
}

export function resolveEmbeddingModel() {
  const value = (process.env.OPENAI_EMBED_MODEL || DEFAULT_EMBEDDING_MODEL).trim();
  return value || DEFAULT_EMBEDDING_MODEL;
}

export function resolveEmbeddingConfig(): ResolvedEmbeddingConfig {
  return {
    providerKey: resolveEmbeddingProviderKey(),
    model: resolveEmbeddingModel(),
  };
}

@Injectable()
export class EmbeddingService {
  resolveConfig(): ResolvedEmbeddingConfig {
    return resolveEmbeddingConfig();
  }

  supportsResolvedConfig(config: ResolvedEmbeddingConfig) {
    return config.providerKey === DEFAULT_EMBEDDING_PROVIDER_KEY;
  }

  async embedWithResolvedConfig(
    text: string,
    config: ResolvedEmbeddingConfig,
    authorizeTransport: EmbeddingTransportAuthorization,
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
      fetch: async (input, init) => {
        const requestUrl = input instanceof Request ? input.url : input.toString();
        if (!isAllowedEmbeddingRequestUrl(requestUrl)) {
          throw new Error('Embedding provider target rejected');
        }
        await authorizeTransport();
        return globalThis.fetch(input, { ...init, redirect: 'error' });
      },
    });

    const res = await client.embeddings.create({
      model: config.model,
      input: text,
      encoding_format: 'float',
    });
    const embedding = res.data[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
      throw new Error('Invalid embedding response');
    }
    return embedding;
  }
}
