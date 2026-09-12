import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const DEFAULT_EMBEDDING_PROVIDER_KEY = 'openai';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

export type ResolvedEmbeddingConfig = {
  providerKey: string;
  model: string;
};

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
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  resolveConfig(): ResolvedEmbeddingConfig {
    return resolveEmbeddingConfig();
  }

  supportsResolvedConfig(config: ResolvedEmbeddingConfig) {
    return config.providerKey === DEFAULT_EMBEDDING_PROVIDER_KEY;
  }

  async embedWithResolvedConfig(text: string, config: ResolvedEmbeddingConfig): Promise<number[]> {
    if (!this.supportsResolvedConfig(config)) {
      throw new Error(`Unsupported embedding provider configuration: ${config.providerKey}`);
    }

    const res = await this.client.embeddings.create({ model: config.model, input: text });
    return res.data[0].embedding as unknown as number[];
  }

  async embed(text: string): Promise<number[]> {
    return this.embedWithResolvedConfig(text, this.resolveConfig());
  }
}
