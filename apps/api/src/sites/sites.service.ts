import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import type { Queryable } from '../db/database.service';
import { randomBytes, randomUUID } from 'crypto';
import { SiteConfigInput } from './dto';
import { resolveSiteKey } from './site-key';
import { TenantsService } from '../tenants/tenants.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { UsageLimitService } from '../billing/usage-limit.service';

type SiteRow = {
  id: string;
  site_key: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
  config: Record<string, unknown>;
  is_evaluation_demo?: boolean;
  created_at?: string;
};

type NormalizedSiteRow = SiteRow & {
  site_key: string;
};

function parseSiteConfig(config: Record<string, unknown> | null | undefined) {
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

@Injectable()
export class SitesService {
  constructor(
    private db: PrismaService,
    private readonly tenants: TenantsService,
    private readonly auditLogs: AuditLogService,
    private readonly usageLimits: UsageLimitService,
  ) {}

  private normalizeSite(row: SiteRow | null): NormalizedSiteRow | null {
    if (!row) {
      return null;
    }

    const config = parseSiteConfig(row.config);
    const configuredSiteKey =
      typeof row.site_key === 'string' && row.site_key.trim().length > 0
        ? row.site_key.trim()
        : typeof config.siteKey === 'string'
          ? config.siteKey.trim()
          : '';

    return {
      ...row,
      config,
      is_evaluation_demo: row.is_evaluation_demo === true,
      site_key: configuredSiteKey || row.id,
    };
  }

  private async assertUniqueSiteKey(siteKey: string, excludeId?: string, db: Queryable = this.db) {
    const values = [siteKey];
    let query = `
      SELECT id
      FROM sites
      WHERE site_key = $1
    `;

    if (excludeId) {
      values.push(excludeId);
      query += ` AND id <> $2`;
    }

    query += ` LIMIT 1`;

    const existing = await db.query<{ id: string }>(query, values);
    if (existing.rows[0]) {
      throw new BadRequestException('siteKey already exists');
    }
  }

  async createSite(params: {
    id?: string;
    siteKey?: string;
    tenantId: string;
    name: string;
    allowedDomains: string[];
    config?: SiteConfigInput;
    isEvaluationDemo?: boolean;
  }) {
    const name = params.name.trim();
    const tenantId = await this.tenants.ensureTenantExists(params.tenantId.trim());
    const id = params.id?.trim() || randomUUID();
    const config = parseSiteConfig(params.config);
    const resolvedSiteKey =
      resolveSiteKey(params.siteKey, name) ||
      `site-${id.slice(0, 8)}`;

    const publicKey = 'pk_' + randomBytes(32).toString('hex');
    const { siteKey: _legacySiteKey, ...nextConfig } = config as SiteConfigInput & {
      siteKey?: unknown;
    };

    await this.db.transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`sites:maxSites:${tenantId}`]);
      await this.usageLimits.assertWithinLimit(tenantId, 'maxSites');
      await this.assertUniqueSiteKey(resolvedSiteKey, id, tx);

      await tx.query(
        `INSERT INTO sites(id, site_key, tenant_id, name, allowed_domains, public_key, config, is_evaluation_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           site_key=EXCLUDED.site_key,
           tenant_id=EXCLUDED.tenant_id,
           name=EXCLUDED.name,
           allowed_domains=EXCLUDED.allowed_domains,
           config=(sites.config - 'siteKey') || EXCLUDED.config,
           is_evaluation_demo=EXCLUDED.is_evaluation_demo`,
        [id, resolvedSiteKey, tenantId, name, params.allowedDomains, publicKey, nextConfig, params.isEvaluationDemo === true],
      );
    });

    return this.getSite(id);
  }

  async getSite(id: string): Promise<NormalizedSiteRow | null> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites WHERE id=$1`, [id]);
    return this.normalizeSite(res.rows[0] || null);
  }

  async listSites(): Promise<NormalizedSiteRow[]> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites ORDER BY created_at DESC`);
    return res.rows
      .map((row) => this.normalizeSite(row))
      .filter((row): row is NormalizedSiteRow => row !== null);
  }

  async updateSite(
    siteId: string,
    params: {
      siteKey?: string;
      name?: string;
      allowedDomains?: string[];
      isEvaluationDemo?: boolean;
    },
  ) {
    const site = await this.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const nextName = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : site.name;
    const nextSiteKey =
      typeof params.siteKey === 'string' && params.siteKey.trim()
        ? resolveSiteKey(params.siteKey, site.site_key) || site.site_key
        : site.site_key;
    const nextAllowedDomains =
      Array.isArray(params.allowedDomains) && params.allowedDomains.length > 0
        ? params.allowedDomains.map((entry) => entry.trim()).filter(Boolean)
        : site.allowed_domains;
    const nextIsEvaluationDemo =
      typeof params.isEvaluationDemo === 'boolean' ? params.isEvaluationDemo : site.is_evaluation_demo === true;

    await this.assertUniqueSiteKey(nextSiteKey, siteId);

    await this.db.query(
      `UPDATE sites
       SET name = $2,
           site_key = $3,
           allowed_domains = $4,
           is_evaluation_demo = $5
       WHERE id = $1`,
      [siteId, nextName, nextSiteKey, nextAllowedDomains, nextIsEvaluationDemo],
    );

    return this.getSite(siteId);
  }

  async markLive(
    siteId: string,
    actor: { actorId?: string; actorRole?: string } = {},
  ) {
    const site = await this.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const goLiveAt = new Date().toISOString();
    await this.db.query(
      `UPDATE sites
       SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb
       WHERE id = $1`,
      [
        siteId,
        JSON.stringify({
          goLiveAt,
          isActive: true,
          lifecycleStatus: 'live',
        }),
      ],
    );

    await this.auditLogs.record({
      siteId,
      tenantId: site.tenant_id,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: 'go_live',
      resourceType: 'site',
      resourceId: siteId,
      metadata: { goLiveAt, lifecycleStatus: 'live' },
    });

    return this.getSite(siteId);
  }

  async deleteSite(
    siteId: string,
    actor: { confirmation?: string; actorId?: string | null; actorRole?: string | null } = {},
  ) {
    if (actor.confirmation !== 'löschen') {
      throw new BadRequestException('Zum Löschen muss exakt "löschen" bestätigt werden.');
    }

    const site = await this.getSite(siteId);
    if (!site) {
      throw new BadRequestException('site not found');
    }

    const deleted = await this.db.transaction(async (tx) => {
      const counts: Record<string, number> = {};

      counts.emailJobs = await this.deleteRows(
        tx,
        `DELETE FROM email_jobs
         WHERE metadata->>'siteId' = $1
            OR metadata->>'site_id' = $1
            OR metadata->>'leadId' IN (
              SELECT id FROM widget_leads WHERE site_id = $1
            )
            OR metadata->>'ticketId' IN (
              SELECT id FROM agent_tickets WHERE site_id = $1
            )`,
        [siteId],
      );
      counts.usageEvents = await this.deleteRows(tx, `DELETE FROM usage_events WHERE site_id = $1`, [siteId]);
      counts.usageDaily = await this.deleteRows(tx, `DELETE FROM usage_daily WHERE site_id = $1`, [siteId]);
      counts.evaluationMockHandoffReceipts = await this.deleteRows(
        tx,
        `DELETE FROM evaluation_mock_handoff_receipts WHERE site_id = $1`,
        [siteId],
      );
      counts.evaluationHandoffEvents = await this.deleteRows(
        tx,
        `DELETE FROM evaluation_handoff_events WHERE site_id = $1`,
        [siteId],
      );
      counts.evaluationTicketPreviews = await this.deleteRows(
        tx,
        `DELETE FROM evaluation_ticket_previews WHERE site_id = $1`,
        [siteId],
      );
      counts.evaluationChatSessions = await this.deleteRows(
        tx,
        `DELETE FROM evaluation_chat_sessions WHERE site_id = $1`,
        [siteId],
      );
      counts.agentTickets = await this.deleteRows(tx, `DELETE FROM agent_tickets WHERE site_id = $1`, [siteId]);
      counts.webhookJobs = await this.deleteRows(tx, `DELETE FROM webhook_jobs WHERE site_id = $1`, [siteId]);
      counts.agentContactRequests = await this.deleteRows(
        tx,
        `DELETE FROM agent_contact_requests WHERE site_id = $1`,
        [siteId],
      );
      counts.toolInvocations = await this.deleteRows(tx, `DELETE FROM tool_invocations WHERE site_id = $1`, [siteId]);
      counts.agentRuns = await this.deleteRows(tx, `DELETE FROM agent_runs WHERE site_id = $1`, [siteId]);
      counts.reportRuns = await this.deleteRows(tx, `DELETE FROM report_runs WHERE site_id = $1`, [siteId]);
      counts.reportSubscriptions = await this.deleteRows(
        tx,
        `DELETE FROM report_subscriptions WHERE site_id = $1`,
        [siteId],
      );
      counts.widgetLeads = await this.deleteRows(tx, `DELETE FROM widget_leads WHERE site_id = $1`, [siteId]);
      counts.widgetEvents = await this.deleteRows(tx, `DELETE FROM widget_events WHERE site_id = $1`, [siteId]);
      counts.widgetSessions = await this.deleteRows(tx, `DELETE FROM widget_sessions WHERE site_id = $1`, [siteId]);
      counts.chunks = await this.deleteRows(tx, `DELETE FROM chunks WHERE site_id = $1`, [siteId]);
      counts.documents = await this.deleteRows(tx, `DELETE FROM documents WHERE site_id = $1`, [siteId]);
      counts.knowledgeSources = await this.deleteRows(tx, `DELETE FROM knowledge_sources WHERE site_id = $1`, [siteId]);
      counts.integrationConnections = await this.deleteRows(
        tx,
        `DELETE FROM integration_connections WHERE site_id = $1`,
        [siteId],
      );
      counts.siteModules = await this.deleteRows(tx, `DELETE FROM site_modules WHERE site_id = $1`, [siteId]);

      await tx.query(
        `INSERT INTO audit_logs(id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          siteId,
          site.tenant_id,
          actor.actorId || null,
          actor.actorRole || null,
          'site.deleted',
          'site',
          siteId,
          JSON.stringify({
            siteKey: site.site_key,
            counts,
          }),
        ],
      );

      counts.sites = await this.deleteRows(tx, `DELETE FROM sites WHERE id = $1`, [siteId]);
      return counts;
    });

    return {
      ok: true,
      deletedSiteId: siteId,
      deleted,
    };
  }

  private async deleteRows(db: Queryable, sql: string, params: unknown[]) {
    const result = await db.query<{ count: string }>(
      `WITH deleted AS (${sql} RETURNING 1)
       SELECT COUNT(*)::text AS count FROM deleted`,
      params,
    );
    return Number(result.rows[0]?.count || 0);
  }
}
