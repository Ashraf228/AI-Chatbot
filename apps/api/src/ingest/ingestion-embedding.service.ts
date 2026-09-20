import { BadGatewayException, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../db/prisma.service';
import { resolveEmbeddingConfig } from '../vector/embedding.service';
import { ProviderApprovalStorageLookupService } from '../knowledge-sources/provider-approval-storage-lookup.service';
import { evaluateProviderApprovalPolicy } from '../knowledge-sources/provider-approval-policy';
import { resolveSiteRuntimeGrantDeploymentEnvironment } from '../knowledge-sources/site-runtime-grant-runtime-contract';

export type IngestionPurpose = 'knowledge_ingest' | 'knowledge_reindex' | 'website_ingest_runtime_indexing';
export type IngestionEmbeddingContext = {
  tenantId: string;
  siteId: string;
  sourceId: string;
  purpose: IngestionPurpose;
};

export const INGESTION_FAILURE = 'Wissensverarbeitung derzeit nicht verfuegbar.';

@Injectable()
export class IngestionEmbeddingService {
  constructor(
    private readonly db: PrismaService,
    private readonly approvalLookup: ProviderApprovalStorageLookupService,
  ) {}

  resolveConfig() { return resolveEmbeddingConfig(); }

  async embed(text: string, context: IngestionEmbeddingContext, options: { signal?: AbortSignal } = {}): Promise<number[]> {
    try {
      const config = resolveEmbeddingConfig();
      const environment = resolveSiteRuntimeGrantDeploymentEnvironment();
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      const baseURL = 'https://api.openai.com/v1';
      if (!context?.tenantId?.trim() || !context.siteId?.trim() || !context.sourceId?.trim()
        || !['knowledge_ingest', 'knowledge_reindex', 'website_ingest_runtime_indexing'].includes(context.purpose)
        || !text.trim() || !environment.supported || !apiKey || config.providerKey !== 'openai'
        || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(config.model)
        || (process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, '') || baseURL) !== baseURL) {
        throw new Error('Invalid ingestion context');
      }

      // A separate client keeps the existing query transport contract unchanged.
      // No SDK retry may reuse an authorization decision.
      const client = new OpenAI({
        apiKey, baseURL, maxRetries: 0, logLevel: 'off', timeout: 30_000,
        fetch: async (input, init) => {
          const url = new URL(input instanceof Request ? input.url : input.toString());
          if (url.origin !== 'https://api.openai.com' || url.pathname !== '/v1/embeddings'
            || url.username || url.password || url.search || url.hash) {
            throw new Error('Invalid ingestion target');
          }
          // Resolve ownership and the persisted grant at the actual HTTP boundary,
          // once per chunk/attempt, with no batch authorization cache.
          options.signal?.throwIfAborted();
          const source = await this.db.query<{ source_type: string; is_active: boolean }>(
            `SELECT ks.source_type, ks.is_active FROM knowledge_sources ks
             JOIN sites s ON s.id = ks.site_id AND s.tenant_id = ks.tenant_id
             WHERE ks.id = $1 AND ks.site_id = $2 AND ks.tenant_id = $3`,
            [context.sourceId, context.siteId, context.tenantId],
          );
          const sourceType = source.rows[0]?.source_type;
          const website = context.purpose === 'website_ingest_runtime_indexing';
          if (source.rows.length !== 1 || (website
            ? sourceType !== 'url' || source.rows[0].is_active !== true
            : !['faq', 'manual', 'pdf', 'it_support_template'].includes(sourceType))) {
            throw new Error('Invalid ingestion source');
          }
          const lookup = {
            ...context, sourceType, usageContext: context.purpose,
            environment: environment.environment, providerKey: config.providerKey, model: config.model,
          };
          const policy = await this.approvalLookup.findProviderApprovalGrant(lookup);
          const decision = evaluateProviderApprovalPolicy({
            ...lookup, policy, provider: config.providerKey, requiredScopeKinds: ['source', 'source_type'],
          });
          if (!decision.allowed || policy?.purpose !== context.purpose
            || (website && policy.embeddingDimension !== 1536)
            || policy.usageContexts.length !== 1 || policy.usageContexts[0] !== context.purpose) {
            throw new Error('Ingestion denied');
          }
          options.signal?.throwIfAborted();
          return globalThis.fetch(input, { ...init, redirect: 'error' });
        },
      });
      const response = await client.embeddings.create({ model: config.model, input: text, encoding_format: 'float' }, { signal: options.signal });
      const vector = response.data[0]?.embedding;
      if (!Array.isArray(vector) || !vector.length || !vector.every(Number.isFinite)
        || (context.purpose === 'website_ingest_runtime_indexing' && vector.length !== 1536)) {
        throw new Error('Invalid ingestion embedding');
      }
      return vector;
    } catch {
      // Neither SDK errors nor grant/storage details cross this boundary.
      throw new BadGatewayException(INGESTION_FAILURE);
    }
  }
}
