import { Injectable } from '@nestjs/common';
import { EmbeddingService, type ResolvedEmbeddingConfig } from '../vector/embedding.service';
import type { ProviderEmbeddingEnvironment } from './provider-embedding-gate';
import {
  type ProviderApprovalStorageLookupDecision,
  type ProviderApprovalStorageLookupDecisionCode,
  ProviderApprovalStorageLookupService,
} from './provider-approval-storage-lookup.service';
import { KnowledgeSourcesService } from './knowledge-sources.service';
import {
  buildSiteRuntimeGrantRuntimeContract,
  type SiteRuntimeGrantRuntimeContract,
} from './site-runtime-grant-runtime-contract';

export type RuntimeQueryEmbeddingDeniedDecisionCode =
  | ProviderApprovalStorageLookupDecisionCode
  | 'invalid_runtime_scope'
  | 'unsupported_provider_configuration';

type RuntimeQueryEmbeddingMetadata = {
  environment: ProviderEmbeddingEnvironment | null;
  providerKey: string;
  model: string;
};

export type RuntimeQueryEmbeddingResult =
  | ({
      kind: 'embedded';
      decisionCode: 'allowed';
      reason: string;
      sanitizedMessage: string;
      embedding: number[];
    } & RuntimeQueryEmbeddingMetadata)
  | ({
      kind: 'no_ready_sources';
      decisionCode: 'no_ready_sources';
      reason: string;
      sanitizedMessage: string;
    } & RuntimeQueryEmbeddingMetadata)
  | ({
      kind: 'denied';
      decisionCode: RuntimeQueryEmbeddingDeniedDecisionCode;
      reason: string;
      sanitizedMessage: string;
    } & RuntimeQueryEmbeddingMetadata);

class RuntimeQueryEmbeddingTransportDeniedError extends Error {
  constructor(readonly decision: ProviderApprovalStorageLookupDecision) {
    super('runtime_query_embedding_transport_denied');
  }
}

function findTransportDenial(error: unknown): RuntimeQueryEmbeddingTransportDeniedError | null {
  const seen = new Set<unknown>();
  let current = error;

  while (current && typeof current === 'object' && !seen.has(current)) {
    if (current instanceof RuntimeQueryEmbeddingTransportDeniedError) {
      return current;
    }
    seen.add(current);
    current = 'cause' in current ? current.cause : null;
  }

  return null;
}

@Injectable()
export class RuntimeQueryEmbeddingService {
  constructor(
    private readonly knowledgeSources: KnowledgeSourcesService,
    private readonly approvalLookup: ProviderApprovalStorageLookupService,
    private readonly embedder: EmbeddingService,
  ) {}

  resolveRuntimeContract(): SiteRuntimeGrantRuntimeContract {
    const config = this.embedder.resolveConfig();
    return buildSiteRuntimeGrantRuntimeContract(config, this.embedder.supportsResolvedConfig(config));
  }

  private buildMetadata(
    config: ResolvedEmbeddingConfig,
    environment: ProviderEmbeddingEnvironment | null,
  ): RuntimeQueryEmbeddingMetadata {
    return {
      environment,
      providerKey: config.providerKey,
      model: config.model,
    };
  }

  private buildDeniedResult(input: {
    decisionCode: RuntimeQueryEmbeddingDeniedDecisionCode;
    reason: string;
    sanitizedMessage: string;
    config: ResolvedEmbeddingConfig;
    environment: ProviderEmbeddingEnvironment | null;
  }): RuntimeQueryEmbeddingResult {
    return {
      kind: 'denied',
      decisionCode: input.decisionCode,
      reason: input.reason,
      sanitizedMessage: input.sanitizedMessage,
      ...this.buildMetadata(input.config, input.environment),
    };
  }

  async embedAuthorizedQuery(input: {
    tenantId: string;
    siteId: string;
    query: string;
    signal?: AbortSignal;
  }): Promise<RuntimeQueryEmbeddingResult> {
    const tenantId = input.tenantId.trim();
    const siteId = input.siteId.trim();
    const query = input.query.trim();
    const config = this.embedder.resolveConfig();
    const runtimeContract = buildSiteRuntimeGrantRuntimeContract(
      config,
      this.embedder.supportsResolvedConfig(config),
    );
    const environment = runtimeContract.environment;

    if (!tenantId || !siteId || !query) {
      return this.buildDeniedResult({
        decisionCode: 'invalid_runtime_scope',
        reason: 'runtime_query_embedding_tenant_site_or_query_missing',
        sanitizedMessage: 'Die Wissenssuche ist derzeit nicht sicher verfuegbar.',
        config,
        environment,
      });
    }

    if (!runtimeContract.supported) {
      return this.buildDeniedResult({
        decisionCode: 'unsupported_provider_configuration',
        reason: runtimeContract.reason === 'invalid_deployment_environment'
          ? 'runtime_query_embedding_deployment_environment_invalid'
          : 'runtime_query_embedding_provider_configuration_unresolved',
        sanitizedMessage: 'Die Wissenssuche ist derzeit nicht sicher verfuegbar.',
        config,
        environment,
      });
    }

    const hasReadySources = await this.knowledgeSources.hasActiveRuntimeReadySource(tenantId, siteId);
    if (!hasReadySources) {
      return {
        kind: 'no_ready_sources',
        decisionCode: 'no_ready_sources',
        reason: 'runtime_query_embedding_no_ready_sources',
        sanitizedMessage: 'Keine answer-ready Wissensquellen aktiv.',
        ...this.buildMetadata(config, environment),
      };
    }

    let embedding: number[];
    try {
      embedding = await this.embedder.embedWithResolvedConfig(query, config, async () => {
        const decision = await this.approvalLookup.evaluateSiteRuntimeQueryEmbeddingApprovalFromStorage({
          tenantId,
          siteId,
          environment,
          providerKey: config.providerKey,
          model: config.model,
        });
        if (!decision.allowed) {
          throw new RuntimeQueryEmbeddingTransportDeniedError(decision);
        }
      }, { signal: input.signal });
    } catch (error) {
      const transportDenial = findTransportDenial(error);
      if (transportDenial) {
        return this.buildDeniedResult({
          decisionCode: transportDenial.decision.decisionCode,
          reason: transportDenial.decision.reason,
          sanitizedMessage: transportDenial.decision.sanitizedMessage,
          config,
          environment,
        });
      }
      throw error;
    }

    return {
      kind: 'embedded',
      decisionCode: 'allowed',
      reason: 'runtime_query_embedding_authorized',
      sanitizedMessage: 'Die Wissenssuche ist fuer diesen Runtime-Kontext technisch autorisiert.',
      embedding,
      ...this.buildMetadata(config, environment),
    };
  }
}
