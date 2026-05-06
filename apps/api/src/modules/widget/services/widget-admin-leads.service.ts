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
         s.name AS site_name
       FROM widget_leads l
       JOIN sites s ON s.id = l.site_id
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
