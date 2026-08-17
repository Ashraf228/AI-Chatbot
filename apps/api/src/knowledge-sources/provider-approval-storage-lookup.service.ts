import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import {
  evaluateProviderApprovalPolicy,
  type ProviderApprovalPolicy,
  type ProviderApprovalPolicyDecisionCode,
} from './provider-approval-policy';
import type {
  ProviderEmbeddingEnvironment,
  ProviderEmbeddingUsageContext,
} from './provider-embedding-gate';

type ProviderApprovalGrantRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  source_id: string | null;
  source_types: unknown;
  usage_contexts: unknown;
  environment: string;
  provider_key: string;
  model: string;
  embedding_dimension: number | null;
  provider_region: string | null;
  data_categories: unknown;
  customer_data_approved: boolean;
  production_approved: boolean;
  provider_dpa_approved: boolean;
  purpose: string;
  retention_policy: string;
  redaction_policy: string;
  logging_policy: string;
  deletion_policy: string;
  reindex_policy: string | null;
  rate_limit: string;
  cost_limit: string;
  valid_from: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  approved_by: string;
  approval_evidence_ref: string;
};

export type ProviderApprovalStorageLookupInput = {
  tenantId?: string | null;
  siteId?: string | null;
  sourceId?: string | null;
  sourceType?: string | null;
  usageContext?: ProviderEmbeddingUsageContext | string | null;
  environment?: ProviderEmbeddingEnvironment | null;
  providerKey?: string | null;
  model?: string | null;
  now?: Date | string | null;
};

export type ProviderApprovalStorageLookupDecisionCode =
  | 'allowed'
  | 'missing_policy'
  | 'not_granted'
  | ProviderApprovalPolicyDecisionCode;

export type ProviderApprovalStorageLookupDecision = {
  allowed: boolean;
  decisionCode: ProviderApprovalStorageLookupDecisionCode;
  reason: string;
  sanitizedMessage: string;
  policy: ProviderApprovalPolicy | null;
  approvalGrantId?: string | null;
  approvalEvidenceRef?: string | null;
  expiresAt?: string | null;
  providerKey?: string | null;
  model?: string | null;
  policyDecision?: ProviderApprovalPolicyDecisionCode | null;
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : null;
}

function toIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  return null;
}

function trimLookupInput(input: ProviderApprovalStorageLookupInput) {
  return {
    tenantId: (input.tenantId || '').trim(),
    siteId: (input.siteId || '').trim(),
    sourceId: hasText(input.sourceId) ? input.sourceId.trim() : null,
    sourceType: (input.sourceType || '').trim(),
    usageContext: (input.usageContext || '').trim(),
    environment: (input.environment || 'non_production').trim() as ProviderEmbeddingEnvironment,
    providerKey: (input.providerKey || '').trim(),
    model: (input.model || '').trim(),
    now: toIsoTimestamp(input.now) || new Date().toISOString(),
  };
}

function deny(
  decisionCode: ProviderApprovalStorageLookupDecisionCode,
  reason: string,
  sanitizedMessage: string,
): ProviderApprovalStorageLookupDecision {
  return {
    allowed: false,
    decisionCode,
    reason,
    sanitizedMessage,
    policy: null,
    approvalGrantId: null,
    approvalEvidenceRef: null,
    expiresAt: null,
    providerKey: null,
    model: null,
    policyDecision: null,
  };
}

function allow(
  policy: ProviderApprovalPolicy,
  policyDecision: ProviderApprovalPolicyDecisionCode,
): ProviderApprovalStorageLookupDecision {
  return {
    allowed: true,
    decisionCode: 'allowed',
    reason: 'provider_approval_storage_lookup_matched',
    sanitizedMessage: 'Ein gueltiger technischer Storage-Grant deckt diesen Provider-/Embedding-Kontext ab.',
    policy,
    approvalGrantId: policy.approvalId,
    approvalEvidenceRef: policy.approvalEvidenceRef,
    expiresAt: policy.expiresAt,
    providerKey: policy.provider,
    model: policy.model,
    policyDecision,
  };
}

export function buildProviderApprovalLookupQuery(input: ProviderApprovalStorageLookupInput): {
  sql: string;
  params: readonly unknown[];
} {
  const normalized = trimLookupInput(input);

  return {
    sql: `
      SELECT
        id,
        tenant_id,
        site_id,
        source_id,
        source_types,
        usage_contexts,
        environment,
        provider_key,
        model,
        embedding_dimension,
        provider_region,
        data_categories,
        customer_data_approved,
        production_approved,
        provider_dpa_approved,
        purpose,
        retention_policy,
        redaction_policy,
        logging_policy,
        deletion_policy,
        reindex_policy,
        rate_limit,
        cost_limit,
        valid_from,
        expires_at,
        revoked_at,
        approved_by,
        approval_evidence_ref
      FROM provider_approval_grants
      WHERE tenant_id = $1
        AND site_id = $2
        AND provider_key = $3
        AND model = $4
        AND environment = $5
        AND revoked_at IS NULL
        AND valid_from <= $6::timestamptz
        AND expires_at > $6::timestamptz
        AND customer_data_approved = true
        AND provider_dpa_approved = true
        AND ($5 <> 'production' OR production_approved = true)
        AND source_types ? $7
        AND usage_contexts ? $8
        AND (
          ($9::text IS NULL AND source_id IS NULL)
          OR ($9::text IS NOT NULL AND (source_id = $9 OR source_id IS NULL))
        )
      ORDER BY
        CASE WHEN source_id = $9 THEN 0 ELSE 1 END,
        valid_from DESC,
        created_at DESC
      LIMIT 1
    `,
    params: [
      normalized.tenantId,
      normalized.siteId,
      normalized.providerKey,
      normalized.model,
      normalized.environment,
      normalized.now,
      normalized.sourceType,
      normalized.usageContext,
      normalized.sourceId,
    ],
  };
}

export function mapProviderApprovalGrantRow(row: ProviderApprovalGrantRow | null | undefined): ProviderApprovalPolicy | null {
  if (!row) {
    return null;
  }

  const sourceTypes = normalizeStringArray(row.source_types);
  const usageContexts = normalizeStringArray(row.usage_contexts);
  const dataCategories = normalizeStringArray(row.data_categories);
  const validFrom = toIsoTimestamp(row.valid_from);
  const expiresAt = toIsoTimestamp(row.expires_at);
  const revokedAt = row.revoked_at == null ? null : toIsoTimestamp(row.revoked_at);

  if (
    !hasText(row.id) ||
    !hasText(row.tenant_id) ||
    !hasText(row.site_id) ||
    !sourceTypes ||
    !usageContexts ||
    !hasText(row.environment) ||
    !hasText(row.provider_key) ||
    !hasText(row.model) ||
    !dataCategories ||
    !hasText(row.purpose) ||
    !hasText(row.retention_policy) ||
    !hasText(row.redaction_policy) ||
    !hasText(row.logging_policy) ||
    !hasText(row.deletion_policy) ||
    !hasText(row.rate_limit) ||
    !hasText(row.cost_limit) ||
    !validFrom ||
    !expiresAt ||
    !hasText(row.approved_by) ||
    !hasText(row.approval_evidence_ref)
  ) {
    return null;
  }

  return {
    approvalId: row.id.trim(),
    tenantId: row.tenant_id.trim(),
    siteId: row.site_id.trim(),
    sourceId: hasText(row.source_id) ? row.source_id.trim() : null,
    sourceTypes,
    usageContexts: usageContexts as ProviderEmbeddingUsageContext[],
    environment: row.environment.trim() as ProviderEmbeddingEnvironment,
    provider: row.provider_key.trim(),
    model: row.model.trim(),
    embeddingDimension: typeof row.embedding_dimension === 'number' ? row.embedding_dimension : null,
    providerRegion: hasText(row.provider_region) ? row.provider_region.trim() : null,
    dataCategories,
    customerDataApproved: row.customer_data_approved === true,
    productionApproved: row.production_approved === true,
    providerDpaApproved: row.provider_dpa_approved === true,
    purpose: row.purpose.trim(),
    retentionPolicy: row.retention_policy.trim(),
    redactionPolicy: row.redaction_policy.trim(),
    loggingPolicy: row.logging_policy.trim(),
    deletionPolicy: row.deletion_policy.trim(),
    reindexPolicy: hasText(row.reindex_policy) ? row.reindex_policy.trim() : null,
    rateLimit: row.rate_limit.trim(),
    costLimit: row.cost_limit.trim(),
    validFrom,
    expiresAt,
    revokedAt,
    approvedBy: row.approved_by.trim(),
    approvalEvidenceRef: row.approval_evidence_ref.trim(),
  };
}

export function evaluateStoredProviderApprovalGrant(
  input: ProviderApprovalStorageLookupInput & { policy?: ProviderApprovalPolicy | null },
): ProviderApprovalStorageLookupDecision {
  if (!input.policy) {
    return deny(
      'missing_policy',
      'provider_approval_storage_grant_missing',
      'Ohne gueltigen Storage-Grant bleibt der Provider-/Embedding-Pfad gesperrt.',
    );
  }

  const decision = evaluateProviderApprovalPolicy({
    policy: input.policy,
    tenantId: input.tenantId,
    siteId: input.siteId,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    usageContext: input.usageContext,
    environment: input.environment,
    provider: input.providerKey,
    model: input.model,
    now: input.now,
  });

  if (!decision.allowed) {
    return {
      allowed: false,
      decisionCode: decision.decisionCode,
      reason: decision.reason,
      sanitizedMessage: decision.sanitizedMessage,
      policy: null,
      approvalGrantId: input.policy.approvalId,
      approvalEvidenceRef: input.policy.approvalEvidenceRef,
      expiresAt: input.policy.expiresAt,
      providerKey: input.policy.provider,
      model: input.policy.model,
      policyDecision: decision.decisionCode,
    };
  }

  return allow(input.policy, decision.decisionCode);
}

@Injectable()
export class ProviderApprovalStorageLookupService {
  constructor(private readonly db: PrismaService) {}

  async findProviderApprovalGrant(
    input: ProviderApprovalStorageLookupInput,
  ): Promise<ProviderApprovalPolicy | null> {
    const normalized = trimLookupInput(input);
    if (
      !normalized.tenantId ||
      !normalized.siteId ||
      !normalized.sourceType ||
      !normalized.usageContext ||
      !normalized.providerKey ||
      !normalized.model
    ) {
      return null;
    }

    const { sql, params } = buildProviderApprovalLookupQuery(input);
    const res = await this.db.query<ProviderApprovalGrantRow>(sql, params);
    return mapProviderApprovalGrantRow(res.rows[0]);
  }

  async evaluateProviderApprovalFromStorage(
    input: ProviderApprovalStorageLookupInput,
  ): Promise<ProviderApprovalStorageLookupDecision> {
    try {
      const policy = await this.findProviderApprovalGrant(input);
      if (!policy) {
        return deny(
          'missing_policy',
          'provider_approval_storage_grant_missing',
          'Ohne gueltigen Storage-Grant bleibt der Provider-/Embedding-Pfad gesperrt.',
        );
      }

      return evaluateStoredProviderApprovalGrant({
        ...input,
        policy,
      });
    } catch {
      return deny(
        'not_granted',
        'provider_approval_storage_lookup_failed',
        'Der technische Approval-Storage-Lookup konnte nicht bestaetigt werden.',
      );
    }
  }
}
