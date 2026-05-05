import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../db/prisma.service';

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
}
