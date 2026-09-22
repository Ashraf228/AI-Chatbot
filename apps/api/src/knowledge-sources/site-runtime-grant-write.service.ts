import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Queryable } from '../db/database.service';
import { PrismaService } from '../db/prisma.service';
import {
  validateProviderApprovalPolicy,
  type ProviderApprovalPolicy,
  type ProviderApprovalPolicyDecision,
} from './provider-approval-policy';
import { ProviderApprovalAuditWriter } from './provider-approval-audit-writer.service';
import { RuntimeQueryEmbeddingService } from './runtime-query-embedding.service';
import {
  resolveSiteRuntimeLlmGrantRuntimeContract,
  type SiteRuntimeGrantRuntimeContract,
  type SupportedSiteRuntimeGrantRuntimeContract,
} from './site-runtime-grant-runtime-contract';

const SITE_RUNTIME_SCOPE_KIND = 'site_runtime';
type SiteRuntimeGrantPurpose = 'query_embedding' | 'llm_generation';

type SiteRuntimeGrantTerms = {
  validFrom: string;
  expiresAt: string;
  embeddingDimension: number | null;
  providerRegion: string | null;
  dataCategories: string[];
  customerDataApproved: boolean;
  productionApproved: boolean;
  providerDpaApproved: boolean;
  retentionPolicy: string;
  redactionPolicy: string;
  loggingPolicy: string;
  deletionPolicy: string;
  reindexPolicy: string | null;
  rateLimit: string;
  costLimit: string;
  approvalEvidenceRef: string;
};

/**
 * This internal-only context must come from a future server-side authenticated
 * and authorized caller. A supplied role is validated defensively here, but is
 * not itself proof of authentication and is never derived from headers or keys.
 */
type SiteRuntimeGrantContext = {
  tenantId: string;
  siteId: string;
  actorId: string;
  actorRole: 'admin';
};

type GrantRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  source_id: string | null;
  source_types: unknown;
  usage_contexts: unknown;
  scope_kind: string;
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
  revoked_by: string | null;
  revocation_reason: string | null;
  approved_by: string;
  approval_evidence_ref: string;
};

type GrantProjection = {
  id: string;
  providerKey: string;
  model: string;
  environment: string;
  validFrom: string;
  expiresAt: string;
  status: 'scheduled' | 'active' | 'expired' | 'revoked';
  revokedAt: string | null;
};

type WriteError = {
  kind: 'invalid_context' | 'invalid_terms' | 'unsupported_runtime_configuration' | 'not_found';
  reason: string;
};

export type SiteRuntimeGrantPreviewResult =
  | WriteError
  | { kind: 'would_create'; runtime: Pick<GrantProjection, 'providerKey' | 'model' | 'environment'> }
  | { kind: 'would_reuse'; grant: GrantProjection }
  | { kind: 'would_conflict'; grant: GrantProjection };

export type SiteRuntimeGrantCreateResult =
  | WriteError
  | { kind: 'created'; grant: GrantProjection }
  | { kind: 'reused'; grant: GrantProjection }
  | { kind: 'conflict'; grant: GrantProjection | null };

export type SiteRuntimeGrantRevokeResult =
  | WriteError
  | { kind: 'revoked'; grant: GrantProjection }
  | { kind: 'already_revoked'; grant: GrantProjection };

export type SiteRuntimeGrantStatusResult =
  | WriteError
  | { kind: 'found'; grant: GrantProjection };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.trim().length > 0);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isText);
}

function isOptionalPositiveInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function parseContext(value: unknown): SiteRuntimeGrantContext | WriteError {
  if (!isRecord(value) || Object.keys(value).some((key) => !['tenantId', 'siteId', 'actorId', 'actorRole'].includes(key))) {
    return { kind: 'invalid_context', reason: 'site_runtime_grant_context_invalid' };
  }

  if (!isText(value.tenantId) || !isText(value.siteId) || !isText(value.actorId)) {
    return { kind: 'invalid_context', reason: 'site_runtime_grant_context_missing' };
  }

  if (value.actorRole !== 'admin') {
    return { kind: 'invalid_context', reason: 'site_runtime_grant_admin_role_required' };
  }

  return {
    tenantId: value.tenantId.trim(),
    siteId: value.siteId.trim(),
    actorId: value.actorId.trim(),
    actorRole: 'admin',
  };
}

function parseTerms(value: unknown): SiteRuntimeGrantTerms | WriteError {
  const allowedKeys = new Set([
    'validFrom', 'expiresAt', 'embeddingDimension', 'providerRegion', 'dataCategories',
    'customerDataApproved', 'productionApproved', 'providerDpaApproved', 'retentionPolicy',
    'redactionPolicy', 'loggingPolicy', 'deletionPolicy', 'reindexPolicy', 'rateLimit',
    'costLimit', 'approvalEvidenceRef',
  ]);
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_terms_reserved_or_unknown_field' };
  }

  if (
    !isText(value.validFrom) || !isText(value.expiresAt) || !isOptionalPositiveInteger(value.embeddingDimension)
    || !isOptionalText(value.providerRegion) || !isStringList(value.dataCategories)
    || typeof value.customerDataApproved !== 'boolean' || typeof value.productionApproved !== 'boolean'
    || typeof value.providerDpaApproved !== 'boolean' || !isText(value.retentionPolicy)
    || !isText(value.redactionPolicy) || !isText(value.loggingPolicy) || !isText(value.deletionPolicy)
    || !isOptionalText(value.reindexPolicy) || !isText(value.rateLimit) || !isText(value.costLimit)
    || !isText(value.approvalEvidenceRef)
  ) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_terms_invalid' };
  }

  return {
    validFrom: value.validFrom,
    expiresAt: value.expiresAt,
    embeddingDimension: value.embeddingDimension,
    providerRegion: value.providerRegion,
    dataCategories: value.dataCategories,
    customerDataApproved: value.customerDataApproved,
    productionApproved: value.productionApproved,
    providerDpaApproved: value.providerDpaApproved,
    retentionPolicy: value.retentionPolicy,
    redactionPolicy: value.redactionPolicy,
    loggingPolicy: value.loggingPolicy,
    deletionPolicy: value.deletionPolicy,
    reindexPolicy: value.reindexPolicy,
    rateLimit: value.rateLimit,
    costLimit: value.costLimit,
    approvalEvidenceRef: value.approvalEvidenceRef,
  };
}

function parseRevokeInput(value: unknown): { grantId: string; revocationReason: string } | WriteError {
  if (!isRecord(value) || Object.keys(value).some((key) => !['grantId', 'revocationReason'].includes(key))) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_revoke_input_invalid' };
  }
  if (!isText(value.grantId) || !isText(value.revocationReason)) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_revoke_input_missing' };
  }
  return { grantId: value.grantId.trim(), revocationReason: value.revocationReason.trim() };
}

function parseGrantId(value: unknown): string | WriteError {
  if (!isText(value)) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_id_invalid' };
  }
  return value.trim();
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sameInstant(left: Date | string, right: string): boolean {
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function sameJsonArray(value: unknown, expected: string[]): boolean {
  return Array.isArray(value) && value.length === expected.length && value.every((entry, index) => entry === expected[index]);
}

function grantStatus(row: GrantRow, now = new Date()): GrantProjection['status'] {
  if (row.revoked_at !== null) return 'revoked';
  if (new Date(row.valid_from).getTime() > now.getTime()) return 'scheduled';
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'active';
}

function projectGrant(row: GrantRow, now = new Date()): GrantProjection {
  return {
    id: row.id,
    providerKey: row.provider_key,
    model: row.model,
    environment: row.environment,
    validFrom: toIso(row.valid_from) || '',
    expiresAt: toIso(row.expires_at) || '',
    status: grantStatus(row, now),
    revokedAt: toIso(row.revoked_at),
  };
}

function overlaps(row: GrantRow, terms: SiteRuntimeGrantTerms): boolean {
  const rowStart = new Date(row.valid_from).getTime();
  const rowEnd = new Date(row.expires_at).getTime();
  const requestedStart = Date.parse(terms.validFrom);
  const requestedEnd = Date.parse(terms.expiresAt);
  return rowStart < requestedEnd && requestedStart < rowEnd;
}

function isExactRepeat(
  row: GrantRow,
  context: SiteRuntimeGrantContext,
  terms: SiteRuntimeGrantTerms,
  runtime: SupportedSiteRuntimeGrantRuntimeContract,
  purpose: SiteRuntimeGrantPurpose,
): boolean {
  return row.revoked_at === null
    && row.tenant_id === context.tenantId
    && row.site_id === context.siteId
    && row.scope_kind === SITE_RUNTIME_SCOPE_KIND
    && row.purpose === purpose
    && row.source_id === null
    && sameJsonArray(row.source_types, [])
    && sameJsonArray(row.usage_contexts, [purpose])
    && row.environment === runtime.environment
    && row.provider_key === runtime.providerKey
    && row.model === runtime.model
    && row.embedding_dimension === terms.embeddingDimension
    && row.provider_region === terms.providerRegion
    && sameJsonArray(row.data_categories, terms.dataCategories)
    && row.customer_data_approved === terms.customerDataApproved
    && row.production_approved === terms.productionApproved
    && row.provider_dpa_approved === terms.providerDpaApproved
    && row.retention_policy === terms.retentionPolicy
    && row.redaction_policy === terms.redactionPolicy
    && row.logging_policy === terms.loggingPolicy
    && row.deletion_policy === terms.deletionPolicy
    && row.reindex_policy === terms.reindexPolicy
    && row.rate_limit === terms.rateLimit
    && row.cost_limit === terms.costLimit
    && sameInstant(row.valid_from, terms.validFrom)
    && sameInstant(row.expires_at, terms.expiresAt)
    && row.approved_by === context.actorId
    && row.approval_evidence_ref === terms.approvalEvidenceRef;
}

function isExpectedOverlapConstraint(error: unknown, purpose: SiteRuntimeGrantPurpose): boolean {
  return !!error && typeof error === 'object'
    && (error as { code?: unknown }).code === '23P01'
    && (error as { constraint?: unknown }).constraint === (purpose === 'query_embedding'
      ? 'provider_approval_grants_site_runtime_no_overlap'
      : 'provider_approval_grants_site_runtime_llm_no_overlap');
}

function buildPolicy(
  approvalId: string,
  context: SiteRuntimeGrantContext,
  terms: SiteRuntimeGrantTerms,
  runtime: SupportedSiteRuntimeGrantRuntimeContract,
  purpose: SiteRuntimeGrantPurpose,
): ProviderApprovalPolicy {
  return {
    approvalId,
    scopeKind: SITE_RUNTIME_SCOPE_KIND,
    tenantId: context.tenantId,
    siteId: context.siteId,
    sourceId: null,
    sourceTypes: [],
    usageContexts: [purpose],
    environment: runtime.environment,
    provider: runtime.providerKey,
    model: runtime.model,
    embeddingDimension: terms.embeddingDimension,
    providerRegion: terms.providerRegion,
    dataCategories: terms.dataCategories,
    customerDataApproved: terms.customerDataApproved,
    productionApproved: terms.productionApproved,
    providerDpaApproved: terms.providerDpaApproved,
    purpose,
    retentionPolicy: terms.retentionPolicy,
    redactionPolicy: terms.redactionPolicy,
    loggingPolicy: terms.loggingPolicy,
    deletionPolicy: terms.deletionPolicy,
    reindexPolicy: terms.reindexPolicy,
    rateLimit: terms.rateLimit,
    costLimit: terms.costLimit,
    validFrom: terms.validFrom,
    expiresAt: terms.expiresAt,
    revokedAt: null,
    approvedBy: context.actorId,
    approvalEvidenceRef: terms.approvalEvidenceRef,
  };
}

function validateTerms(
  context: SiteRuntimeGrantContext,
  terms: SiteRuntimeGrantTerms,
  runtime: SupportedSiteRuntimeGrantRuntimeContract,
  now: Date,
  purpose: SiteRuntimeGrantPurpose,
): WriteError | null {
  if (purpose === 'llm_generation' && (terms.embeddingDimension !== null || terms.reindexPolicy !== null)) {
    return { kind: 'invalid_terms', reason: 'site_runtime_llm_grant_embedding_terms_not_applicable' };
  }
  const validFromMs = Date.parse(terms.validFrom);
  const expiresAtMs = Date.parse(terms.expiresAt);
  if (!Number.isFinite(validFromMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= validFromMs || expiresAtMs <= now.getTime()) {
    return { kind: 'invalid_terms', reason: 'site_runtime_grant_validity_window_invalid' };
  }
  const policyNow = new Date(Math.max(now.getTime(), validFromMs));
  const decision: ProviderApprovalPolicyDecision = validateProviderApprovalPolicy({
    policy: buildPolicy('site-runtime-grant-validation', context, terms, runtime, purpose),
    environment: runtime.environment,
    now: policyNow,
  });
  return decision.allowed ? null : { kind: 'invalid_terms', reason: decision.reason };
}

// Both fixed-purpose wrappers share the transaction, scope and audit implementation.
class SiteRuntimeGrantAdministration {
  constructor(
    private readonly db: PrismaService,
    private readonly auditWriter: ProviderApprovalAuditWriter,
    private readonly resolveRuntimeContract: () => SiteRuntimeGrantRuntimeContract,
    private readonly purpose: SiteRuntimeGrantPurpose,
  ) {}

  async preview(contextInput: unknown, termsInput: unknown): Promise<SiteRuntimeGrantPreviewResult> {
    const context = parseContext(contextInput);
    if ('kind' in context) return context;
    const terms = parseTerms(termsInput);
    if ('kind' in terms) return terms;
    const runtime = this.resolveRuntimeContract();
    if (!runtime.supported) {
      return { kind: 'unsupported_runtime_configuration', reason: 'site_runtime_grant_runtime_configuration_unsupported' };
    }
    const now = new Date();
    const validationError = validateTerms(context, terms, runtime, now, this.purpose);
    if (validationError) return validationError;
    if (!(await this.hasSiteInScope(this.db, context))) return { kind: 'not_found', reason: 'site_runtime_grant_not_found' };

    const grants = await this.readActiveRuntimeGrants(this.db, context, runtime);
    const exact = grants.find((grant) => isExactRepeat(grant, context, terms, runtime, this.purpose));
    if (exact) return { kind: 'would_reuse', grant: projectGrant(exact, now) };
    const conflict = grants.find((grant) => overlaps(grant, terms));
    return conflict
      ? { kind: 'would_conflict', grant: projectGrant(conflict, now) }
      : { kind: 'would_create', runtime: { providerKey: runtime.providerKey, model: runtime.model, environment: runtime.environment } };
  }

  async create(contextInput: unknown, termsInput: unknown): Promise<SiteRuntimeGrantCreateResult> {
    const context = parseContext(contextInput);
    if ('kind' in context) return context;
    const terms = parseTerms(termsInput);
    if ('kind' in terms) return terms;
    const preflightRuntime = this.resolveRuntimeContract();
    if (!preflightRuntime.supported) {
      return { kind: 'unsupported_runtime_configuration', reason: 'site_runtime_grant_runtime_configuration_unsupported' };
    }

    try {
      return await this.db.transaction(async (tx) => {
        if (!(await this.lockSiteInScope(tx, context))) {
          return { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
        }
        const now = await this.readDatabaseNow(tx);
        const runtime = this.resolveRuntimeContract();
        if (!runtime.supported) {
          return { kind: 'unsupported_runtime_configuration', reason: 'site_runtime_grant_runtime_configuration_unsupported' };
        }
        const validationError = validateTerms(context, terms, runtime, now, this.purpose);
        if (validationError) return validationError;

        const grants = await this.readActiveRuntimeGrants(tx, context, runtime, true);
        const exact = grants.find((grant) => isExactRepeat(grant, context, terms, runtime, this.purpose));
        if (exact) return { kind: 'reused', grant: projectGrant(exact, now) };
        const conflict = grants.find((grant) => overlaps(grant, terms));
        if (conflict) return { kind: 'conflict', grant: projectGrant(conflict, now) };

        const row = await this.insertGrant(tx, context, terms, runtime);
        await this.auditWriter.record(tx, {
          tenantId: context.tenantId,
          siteId: context.siteId,
          approvalGrantId: row.id,
          actorId: context.actorId,
          actorRole: context.actorRole,
          eventType: 'approval_created',
          decisionCode: 'allowed',
          providerKey: row.provider_key,
          model: row.model,
          sanitizedReason: `site_runtime_${this.purpose}_grant_created`,
        });
        return { kind: 'created', grant: projectGrant(row, now) };
      });
    } catch (error) {
      if (isExpectedOverlapConstraint(error, this.purpose)) return { kind: 'conflict', grant: null };
      throw error;
    }
  }

  async revoke(contextInput: unknown, input: unknown): Promise<SiteRuntimeGrantRevokeResult> {
    const context = parseContext(contextInput);
    if ('kind' in context) return context;
    const revokeInput = parseRevokeInput(input);
    if ('kind' in revokeInput) return revokeInput;

    return this.db.transaction(async (tx) => {
      if (!(await this.lockSiteInScope(tx, context))) {
        return { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
      }
      const now = await this.readDatabaseNow(tx);
      const grant = await this.readGrantForScope(tx, context, revokeInput.grantId, true);
      if (!grant) return { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
      if (grant.revoked_at !== null) return { kind: 'already_revoked', grant: projectGrant(grant, now) };

      const updated = await tx.query<GrantRow>(
        `UPDATE provider_approval_grants
         SET revoked_at = $1::timestamptz,
             revoked_by = $2,
             revocation_reason = $3,
             updated_at = $1::timestamptz
         WHERE id = $4
           AND tenant_id = $5
           AND site_id = $6
           AND scope_kind = 'site_runtime'
           AND purpose = $7
           AND revoked_at IS NULL
         RETURNING ${this.grantColumns()}`,
        [now.toISOString(), context.actorId, revokeInput.revocationReason, grant.id, context.tenantId, context.siteId, this.purpose],
      );
      const row = updated.rows[0];
      if (!row) return { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
      await this.auditWriter.record(tx, {
        tenantId: context.tenantId,
        siteId: context.siteId,
        approvalGrantId: row.id,
        actorId: context.actorId,
        actorRole: context.actorRole,
        eventType: 'approval_revoked',
        decisionCode: 'revoked',
        providerKey: row.provider_key,
        model: row.model,
        sanitizedReason: `site_runtime_${this.purpose}_grant_revoked`,
      });
      return { kind: 'revoked', grant: projectGrant(row, now) };
    });
  }

  async status(contextInput: unknown, grantIdInput: unknown): Promise<SiteRuntimeGrantStatusResult> {
    const context = parseContext(contextInput);
    if ('kind' in context) return context;
    const grantId = parseGrantId(grantIdInput);
    if (typeof grantId !== 'string') return grantId;
    const grant = await this.readGrantForScope(this.db, context, grantId, false);
    return grant
      ? { kind: 'found', grant: projectGrant(grant) }
      : { kind: 'not_found', reason: 'site_runtime_grant_not_found' };
  }

  private async hasSiteInScope(queryable: Queryable, context: SiteRuntimeGrantContext): Promise<boolean> {
    const result = await queryable.query<{ id: string }>(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2 LIMIT 1',
      [context.siteId, context.tenantId],
    );
    return result.rows.length === 1;
  }

  private async lockSiteInScope(tx: Queryable, context: SiteRuntimeGrantContext): Promise<boolean> {
    const result = await tx.query<{ id: string }>(
      'SELECT id FROM sites WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [context.siteId, context.tenantId],
    );
    return result.rows.length === 1;
  }

  private async readDatabaseNow(tx: Queryable): Promise<Date> {
    const result = await tx.query<{ now: Date | string }>('SELECT now() AS now');
    const value = result.rows[0]?.now;
    const now = value instanceof Date ? value : new Date(value || Date.now());
    if (!Number.isFinite(now.getTime())) throw new Error('Database did not return a valid timestamp');
    return now;
  }

  private async readActiveRuntimeGrants(
    queryable: Queryable,
    context: SiteRuntimeGrantContext,
    runtime: SupportedSiteRuntimeGrantRuntimeContract,
    lock = false,
  ): Promise<GrantRow[]> {
    const lockClause = lock ? ' FOR UPDATE' : '';
    const result = await queryable.query<GrantRow>(
      `SELECT ${this.grantColumns()}
       FROM provider_approval_grants
       WHERE tenant_id = $1
         AND site_id = $2
         AND provider_key = $3
         AND model = $4
         AND environment = $5
         AND scope_kind = 'site_runtime'
         AND purpose = $6
         AND source_id IS NULL
         AND source_types = '[]'::jsonb
         AND usage_contexts = $7::jsonb
         AND revoked_at IS NULL
       ORDER BY valid_from ASC, expires_at ASC, id ASC${lockClause}`,
      [context.tenantId, context.siteId, runtime.providerKey, runtime.model, runtime.environment, this.purpose, JSON.stringify([this.purpose])],
    );
    return result.rows;
  }

  private async readGrantForScope(
    queryable: Queryable,
    context: SiteRuntimeGrantContext,
    grantId: string,
    lock: boolean,
  ): Promise<GrantRow | null> {
    const lockClause = lock ? ' FOR UPDATE' : '';
    const result = await queryable.query<GrantRow>(
      `SELECT ${this.grantColumns()}
       FROM provider_approval_grants
       WHERE id = $1
         AND tenant_id = $2
         AND site_id = $3
         AND scope_kind = 'site_runtime'
         AND purpose = $4${lockClause}`,
      [grantId, context.tenantId, context.siteId, this.purpose],
    );
    return result.rows[0] || null;
  }

  private async insertGrant(
    tx: Queryable,
    context: SiteRuntimeGrantContext,
    terms: SiteRuntimeGrantTerms,
    runtime: SupportedSiteRuntimeGrantRuntimeContract,
  ): Promise<GrantRow> {
    const inserted = await tx.query<GrantRow>(
      `INSERT INTO provider_approval_grants(
         id, tenant_id, site_id, source_id, source_types, usage_contexts, scope_kind,
         environment, provider_key, model, embedding_dimension, provider_region,
         data_categories, customer_data_approved, production_approved, provider_dpa_approved,
         purpose, retention_policy, redaction_policy, logging_policy, deletion_policy,
         reindex_policy, rate_limit, cost_limit, valid_from, expires_at,
         revoked_at, revoked_by, revocation_reason, approved_by, approval_evidence_ref
       ) VALUES (
         $1, $2, $3, NULL, '[]'::jsonb, $25::jsonb, 'site_runtime',
         $4, $5, $6, $7, $8,
         $9::jsonb, $10, $11, $12,
         $24, $13, $14, $15, $16,
         $17, $18, $19, $20::timestamptz, $21::timestamptz,
         NULL, NULL, NULL, $22, $23
       ) RETURNING ${this.grantColumns()}`,
      [
        randomUUID(), context.tenantId, context.siteId,
        runtime.environment, runtime.providerKey, runtime.model,
        terms.embeddingDimension, terms.providerRegion,
        JSON.stringify(terms.dataCategories), terms.customerDataApproved, terms.productionApproved,
        terms.providerDpaApproved, terms.retentionPolicy, terms.redactionPolicy,
        terms.loggingPolicy, terms.deletionPolicy, terms.reindexPolicy, terms.rateLimit,
        terms.costLimit, terms.validFrom, terms.expiresAt, context.actorId, terms.approvalEvidenceRef,
        this.purpose, JSON.stringify([this.purpose]),
      ],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error('Grant insert did not return a row');
    return row;
  }

  private grantColumns() {
    return `id, tenant_id, site_id, source_id, source_types, usage_contexts, scope_kind,
      environment, provider_key, model, embedding_dimension, provider_region,
      data_categories, customer_data_approved, production_approved, provider_dpa_approved,
      purpose, retention_policy, redaction_policy, logging_policy, deletion_policy,
      reindex_policy, rate_limit, cost_limit, valid_from, expires_at,
      revoked_at, revoked_by, revocation_reason, approved_by, approval_evidence_ref`;
  }
}

@Injectable()
export class SiteRuntimeGrantWriteService extends SiteRuntimeGrantAdministration {
  constructor(db: PrismaService, auditWriter: ProviderApprovalAuditWriter,
    runtimeQueryEmbedding: RuntimeQueryEmbeddingService) {
    super(db, auditWriter, () => runtimeQueryEmbedding.resolveRuntimeContract(), 'query_embedding');
  }
}

@Injectable()
export class SiteRuntimeLlmGrantWriteService extends SiteRuntimeGrantAdministration {
  constructor(db: PrismaService, auditWriter: ProviderApprovalAuditWriter) {
    super(db, auditWriter, resolveSiteRuntimeLlmGrantRuntimeContract, 'llm_generation');
  }
}
