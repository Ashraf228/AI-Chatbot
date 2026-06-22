import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../db/prisma.service';
import { DashboardAuthContext } from '../utils/admin-scope.service';

export type EvaluationAccessContext = {
  tenantUserId: string;
  tenantId: string;
  siteId: string;
  accountExpiresAt: string | null;
  sessionExpiresAt: string | null;
  siteDisplayName: string;
  demoStatus: true;
};

type EvaluationAccessRow = {
  tenant_user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  expires_at: string | null;
  evaluation_site_id: string | null;
  site_id: string | null;
  site_tenant_id: string | null;
  site_name: string | null;
  is_evaluation_demo: boolean | null;
  site_active: boolean | null;
};

function isExpired(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

@Injectable()
export class EvaluationAccessService {
  constructor(
    private readonly db: PrismaService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async resolve(auth: DashboardAuthContext): Promise<EvaluationAccessContext> {
    if (auth.role !== 'viewer' || !auth.tenantId || !auth.tenantUserId) {
      await this.deny(auth);
    }

    const res = await this.db.query<EvaluationAccessRow>(
      `SELECT
         tu.id AS tenant_user_id,
         tu.tenant_id,
         tu.role,
         tu.is_active,
         tu.expires_at,
         tu.evaluation_site_id,
         s.id AS site_id,
         s.tenant_id AS site_tenant_id,
         s.name AS site_name,
         s.is_evaluation_demo,
         CASE
           WHEN s.config ? 'isActive' THEN lower(s.config->>'isActive') = 'true'
           ELSE true
         END AS site_active
       FROM tenant_users tu
       LEFT JOIN sites s ON s.id = tu.evaluation_site_id
       WHERE tu.id = $1
       LIMIT 1`,
      [auth.tenantUserId],
    );
    const row = res.rows[0];

    if (
      !row ||
      row.tenant_id !== auth.tenantId ||
      row.role !== 'viewer' ||
      !row.is_active ||
      isExpired(row.expires_at) ||
      !row.evaluation_site_id ||
      !row.site_id ||
      row.site_id !== row.evaluation_site_id ||
      row.site_tenant_id !== row.tenant_id ||
      row.is_evaluation_demo !== true ||
      row.site_active !== true
    ) {
      await this.deny(auth);
    }
    if (!row.site_id) {
      await this.deny(auth);
    }
    const siteId = row.site_id as string;

    return {
      tenantUserId: row.tenant_user_id,
      tenantId: row.tenant_id,
      siteId,
      accountExpiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      sessionExpiresAt: auth.sessionExpiresAt || null,
      siteDisplayName: row.site_name || 'Evaluation',
      demoStatus: true,
    };
  }

  private async deny(auth: DashboardAuthContext): Promise<never> {
    await this.auditLogs.record({
      tenantId: auth.tenantId || null,
      actorId: auth.tenantUserId || auth.actorId || 'dashboard',
      actorRole: typeof auth.role === 'string' ? auth.role : 'unknown',
      action: 'evaluation_access_denied',
      resourceType: 'evaluation_workspace',
      metadata: { result: 'denied' },
    });
    throw new ForbiddenException('Evaluation access denied');
  }
}
