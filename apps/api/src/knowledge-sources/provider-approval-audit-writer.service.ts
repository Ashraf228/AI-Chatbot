import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Queryable } from '../db/database.service';

export type ProviderApprovalAuditEventInput = {
  tenantId: string;
  siteId: string;
  approvalGrantId: string;
  actorId: string;
  actorRole: 'admin';
  eventType: 'approval_created' | 'approval_revoked';
  decisionCode: 'allowed' | 'revoked';
  providerKey: string;
  model: string;
  sanitizedReason: string;
};

@Injectable()
export class ProviderApprovalAuditWriter {
  async record(tx: Queryable, input: ProviderApprovalAuditEventInput): Promise<void> {
    await tx.query(
      `INSERT INTO provider_approval_audit_events(
         id, tenant_id, site_id, source_id, approval_grant_id,
         actor_id, actor_role, event_type, decision_code,
         provider_key, model, usage_context, sanitized_reason,
         request_id, correlation_id, created_at
       ) VALUES (
         $1, $2, $3, NULL, $4,
         $5, $6, $7, $8,
         $9, $10, 'query_embedding', $11,
         NULL, NULL, now()
       )`,
      [
        randomUUID(),
        input.tenantId,
        input.siteId,
        input.approvalGrantId,
        input.actorId,
        input.actorRole,
        input.eventType,
        input.decisionCode,
        input.providerKey,
        input.model,
        input.sanitizedReason,
      ],
    );
  }
}
