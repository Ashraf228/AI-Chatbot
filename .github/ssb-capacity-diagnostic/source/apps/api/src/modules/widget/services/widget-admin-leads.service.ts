import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../db/prisma.service';
import { toCsv } from '../../../utils/csv';

type LeadRow = {
  id: string;
  site_id: string;
  session_id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
  site_name?: string;
  email_delivery_status?: string | null;
  email_retry_count?: number | string | null;
  email_updated_at?: string | null;
  email_sent_at?: string | null;
  email_created_at?: string | null;
  webhook_delivery_status?: string | null;
  webhook_retry_count?: number | string | null;
  webhook_updated_at?: string | null;
  webhook_completed_at?: string | null;
  webhook_created_at?: string | null;
};

type DeliveryChannelStatus = 'not_configured' | 'pending' | 'sent' | 'failed' | 'unknown';

type LeadDelivery = {
  stored: true;
  email: DeliveryChannelStatus;
  webhook: DeliveryChannelStatus;
  emailAttempts: number | null;
  webhookAttempts: number | null;
  emailUpdatedAt: string | null;
  webhookUpdatedAt: string | null;
};

@Injectable()
export class WidgetAdminLeadsService {
  constructor(private readonly db: PrismaService) {}

  async listLeads(params: { siteId?: string; status?: string }) {
    const values: string[] = [];
    const where: string[] = [];

    if (params.siteId) {
      values.push(params.siteId);
      where.push(`l.site_id = $${values.length}`);
    }

    if (params.status) {
      values.push(params.status);
      where.push(`l.status = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const res = await this.db.query<LeadRow>(
      `SELECT
         l.id,
         l.site_id,
         l.session_id,
         l.name,
         l.email,
         l.phone,
         l.message,
         l.status,
         l.created_at,
         s.name AS site_name,
         email_job.status AS email_delivery_status,
         email_job.retry_count AS email_retry_count,
         email_job.sent_at AS email_sent_at,
         email_job.updated_at AS email_updated_at,
         email_job.created_at AS email_created_at,
         webhook_job.status AS webhook_delivery_status,
         webhook_job.retry_count AS webhook_retry_count,
         webhook_job.completed_at AS webhook_completed_at,
         webhook_job.updated_at AS webhook_updated_at,
         webhook_job.created_at AS webhook_created_at
       FROM widget_leads l
       JOIN sites s ON s.id = l.site_id
       LEFT JOIN LATERAL (
         SELECT
           ej.status,
           ej.retry_count,
           ej.sent_at,
           ej.updated_at,
           ej.created_at
         FROM email_jobs ej
         WHERE ej.kind = 'lead_notification'
           AND (
             ej.metadata->>'leadId' = l.id
             OR (
               ej.metadata->>'siteId' = l.site_id
               AND ej.metadata->>'sessionId' = l.session_id
               AND COALESCE(ej.metadata->>'leadEmail', '') <> ''
               AND l.email <> ''
               AND ej.metadata->>'leadEmail' = l.email
             )
           )
         ORDER BY ej.created_at DESC
         LIMIT 1
       ) email_job ON true
       LEFT JOIN LATERAL (
         SELECT
           wj.status,
           wj.retry_count,
           wj.completed_at,
           wj.updated_at,
           wj.created_at
         FROM webhook_jobs wj
         WHERE wj.site_id = l.site_id
           AND wj.payload->>'eventType' = 'lead.created'
           AND (
             wj.payload->>'leadId' = l.id
             OR wj.payload #>> '{payload,leadId}' = l.id
           )
         ORDER BY wj.created_at DESC
         LIMIT 1
       ) webhook_job ON true
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT 200`,
      values,
    );

    return res.rows.map((row) => ({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      sessionId: row.session_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      delivery: buildDelivery(row),
    }));
  }

  async updateLead(id: string, payload: { status: string }) {
    const res = await this.db.query<LeadRow>(
      `UPDATE widget_leads
       SET status = $2
       WHERE id = $1
       RETURNING id, site_id, session_id, name, email, phone, message, status, created_at`,
      [id, payload.status],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Lead not found');
    }

    return {
      id: row.id,
      siteId: row.site_id,
      sessionId: row.session_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async exportLeads(params: {
    siteId?: string;
    status?: string;
    actorId?: string;
    actorRole?: string;
  }) {
    const leads = await this.listLeads({
      siteId: params.siteId,
      status: params.status,
    });

    if (params.siteId) {
      await this.writeAuditLog({
        siteId: params.siteId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        count: leads.length,
      });
    }

    return toCsv([
      ['id', 'siteId', 'siteName', 'name', 'email', 'phone', 'message', 'status', 'createdAt'],
      ...leads.map((lead) => [
        lead.id,
        lead.siteId,
        lead.siteName,
        lead.name,
        lead.email,
        lead.phone,
        lead.message,
        lead.status,
        lead.createdAt,
      ]),
    ]);
  }

  async deleteLead(id: string, actor: { actorId?: string; actorRole?: string } = {}) {
    const res = await this.db.query<LeadRow>(
      `DELETE FROM widget_leads
       WHERE id = $1
       RETURNING id, site_id, session_id, name, email, phone, message, status, created_at`,
      [id],
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Lead not found');
    }

    await this.writeAuditLog({
      siteId: row.site_id,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      count: 1,
      action: 'lead.deleted',
      resourceId: id,
    });

    return { ok: true, deletedLeadId: id };
  }

  private async writeAuditLog(input: {
    siteId: string;
    actorId?: string;
    actorRole?: string;
    count: number;
    action?: string;
    resourceId?: string;
  }) {
    const site = await this.db.query<{ tenant_id: string | null }>(
      `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
      [input.siteId],
    );

    await this.db.query(
      `INSERT INTO audit_logs(
         id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [
        randomUUID(),
        input.siteId,
        site.rows[0]?.tenant_id || null,
        input.actorId || 'dashboard',
        input.actorRole || 'admin',
        input.action || 'leads.exported',
        'lead',
        input.resourceId || input.siteId,
        JSON.stringify({ count: input.count }),
      ],
    );
  }
}

function buildDelivery(row: LeadRow): LeadDelivery {
  return {
    stored: true,
    email: normalizeDeliveryStatus(row.email_delivery_status),
    webhook: normalizeDeliveryStatus(row.webhook_delivery_status),
    emailAttempts: toNullableNumber(row.email_retry_count),
    webhookAttempts: toNullableNumber(row.webhook_retry_count),
    emailUpdatedAt: row.email_sent_at || row.email_updated_at || row.email_created_at || null,
    webhookUpdatedAt: row.webhook_completed_at || row.webhook_updated_at || row.webhook_created_at || null,
  };
}

function normalizeDeliveryStatus(status: string | null | undefined): DeliveryChannelStatus {
  const normalized = (status || '').trim().toLowerCase();
  if (!normalized) {
    return 'not_configured';
  }

  if (['queued', 'processing', 'retrying', 'pending'].includes(normalized)) {
    return 'pending';
  }

  if (['sent', 'delivered', 'completed', 'success'].includes(normalized)) {
    return 'sent';
  }

  if (['failed', 'error', 'dead'].includes(normalized)) {
    return 'failed';
  }

  return 'unknown';
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
