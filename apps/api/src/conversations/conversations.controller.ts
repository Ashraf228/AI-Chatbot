import { Controller, Delete, Get, Header, Param, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AdminScopeService } from '../utils/admin-scope.service';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import { toCsv } from '../utils/csv';

type ConversationListRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  session_id: string;
  created_at: string;
  last_active_at: string;
  message_count: string;
  last_message: string | null;
  last_role: string | null;
  has_lead: boolean;
  has_handoff: boolean;
  has_ticket: boolean;
  tool_count: string;
  decision_type: string | null;
};

type ConversationRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  session_id: string;
  created_at: string;
  last_active_at: string;
};

type ConversationMessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type ConversationExportRow = {
  conversation_id: string;
  tenant_id: string;
  site_id: string;
  session_id: string;
  role: string;
  content: string;
  message_created_at: string;
  conversation_created_at: string;
  last_active_at: string;
};

@UseGuards(AdminKeyGuard)
@Controller('admin/conversations')
export class ConversationsController {
  constructor(
    private db: PrismaService,
    private scope: AdminScopeService,
  ) {}

  @Get()
  async list(@Query('siteId') siteId: string | undefined, @Req() req: { dashboardAuth?: unknown }) {
    const auth = this.scope.getAuth(req);
    const params: string[] = [];
    let where = '';

    if (siteId) {
      await this.scope.assertSiteAccess(auth, siteId, {
        allowedRoles: ['admin', 'operator', 'customer', 'viewer'],
      });
      params.push(siteId);
      where = `WHERE c.site_id = $1`;
    } else {
      this.scope.assertRole(auth, ['admin']);
    }

    const res = await this.db.query<ConversationListRow>(
      `
      SELECT
        c.id,
        c.tenant_id,
        c.site_id,
        c.session_id,
        c.created_at,
        c.last_active_at,
        COUNT(m.id) AS message_count,
        (
          SELECT m2.content
          FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT m2.role
          FROM messages m2
          WHERE m2.conversation_id = c.id
          ORDER BY m2.created_at DESC
          LIMIT 1
        ) AS last_role,
        EXISTS (SELECT 1 FROM widget_leads wl WHERE wl.site_id = c.site_id AND wl.session_id = c.session_id) AS has_lead,
        EXISTS (
          SELECT 1 FROM agent_runs ar
          WHERE ar.metadata->>'conversationId' = c.id
            AND (ar.agent_key = 'handoff' OR ar.metadata->>'decisionType' = 'handoff')
        ) AS has_handoff,
        EXISTS (
          SELECT 1 FROM agent_tickets at
          JOIN agent_runs ar ON ar.id = at.agent_run_id
          WHERE at.site_id = c.site_id
            AND ar.metadata->>'conversationId' = c.id
        ) AS has_ticket,
        (
          SELECT COUNT(*)::text
          FROM tool_invocations ti
          JOIN agent_runs ar ON ar.id = ti.agent_run_id
          WHERE ar.metadata->>'conversationId' = c.id
        ) AS tool_count,
        (
          SELECT ar.metadata->>'decisionType'
          FROM agent_runs ar
          WHERE ar.metadata->>'conversationId' = c.id
            AND ar.metadata ? 'decisionType'
          ORDER BY ar.created_at DESC
          LIMIT 1
        ) AS decision_type
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      ${where}
      GROUP BY c.id
      ORDER BY c.last_active_at DESC
      LIMIT 100
      `,
      params,
    );

    return res.rows;
  }

  @Get('export')
  @RequireDashboardRoles('admin')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="chats.csv"')
  async export(
    @Query('siteId') siteId?: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
  ) {
    const params: string[] = [];
    const where: string[] = [];

    if (siteId) {
      params.push(siteId);
      where.push(`c.site_id = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const res = await this.db.query<ConversationExportRow>(
      `SELECT
         c.id AS conversation_id,
         c.tenant_id,
         c.site_id,
         c.session_id,
         m.role,
         m.content,
         m.created_at AS message_created_at,
         c.created_at AS conversation_created_at,
         c.last_active_at
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       ${whereSql}
       ORDER BY c.last_active_at DESC, m.created_at ASC
       LIMIT 5000`,
      params,
    );

    if (siteId) {
      await this.writeAuditLog({
        siteId,
        actorId,
        actorRole,
        action: 'conversations.exported',
        resourceType: 'conversation',
        resourceId: siteId,
        metadata: { rows: res.rows.length },
      });
    }

    return toCsv([
      [
        'conversationId',
        'tenantId',
        'siteId',
        'sessionId',
        'role',
        'content',
        'messageCreatedAt',
        'conversationCreatedAt',
        'lastActiveAt',
      ],
      ...res.rows.map((row) => [
        row.conversation_id,
        row.tenant_id,
        row.site_id,
        row.session_id,
        row.role,
        row.content,
        row.message_created_at,
        row.conversation_created_at,
        row.last_active_at,
      ]),
    ]);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertConversationAccess(this.scope.getAuth(req), id, {
      allowedRoles: ['admin', 'operator', 'customer', 'viewer'],
    });

    const conv = await this.db.query<ConversationRow>(
      `SELECT * FROM conversations WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!conv.rows[0]) {
      return { message: 'Conversation not found' };
    }

    const msgs = await this.db.query<ConversationMessageRow>(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id],
    );

    return {
      conversation: conv.rows[0],
      messages: msgs.rows,
    };
  }

  @Delete(':id')
  @RequireDashboardRoles('admin')
  async deleteOne(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
  ) {
    const existing = await this.db.query<{ site_id: string; tenant_id: string }>(
      `SELECT site_id, tenant_id FROM conversations WHERE id = $1 LIMIT 1`,
      [id],
    );

    await this.db.query(
      `DELETE FROM conversations WHERE id = $1`,
      [id],
    );

    if (existing.rows[0]) {
      await this.writeAuditLog({
        siteId: existing.rows[0].site_id,
        tenantId: existing.rows[0].tenant_id,
        actorId,
        actorRole,
        action: 'conversation.deleted',
        resourceType: 'conversation',
        resourceId: id,
        metadata: {},
      });
    }

    return { ok: true, deletedConversationId: id };
  }

  @Delete()
  @RequireDashboardRoles('admin')
  async deleteBySite(
    @Query('siteId') siteId?: string,
    @Query('actorId') actorId?: string,
    @Query('actorRole') actorRole?: string,
  ) {
    if (!siteId) {
      return { message: 'siteId missing' };
    }

    const deleted = await this.db.query<{ id: string; tenant_id: string }>(
      `DELETE FROM conversations WHERE site_id = $1 RETURNING id, tenant_id`,
      [siteId],
    );

    await this.writeAuditLog({
      siteId,
      actorId,
      actorRole,
      action: 'conversations.deleted',
      resourceType: 'conversation',
      resourceId: siteId,
      metadata: { count: deleted.rows.length },
    });

    return { ok: true, deletedSiteId: siteId };
  }

  private async writeAuditLog(input: {
    siteId: string;
    tenantId?: string;
    actorId?: string;
    actorRole?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
  }) {
    let tenantId = input.tenantId;
    if (!tenantId) {
      const site = await this.db.query<{ tenant_id: string | null }>(
        `SELECT tenant_id FROM sites WHERE id = $1 LIMIT 1`,
        [input.siteId],
      );
      tenantId = site.rows[0]?.tenant_id || undefined;
    }

    await this.db.query(
      `INSERT INTO audit_logs(
         id, site_id, tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata, created_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
      [
        randomUUID(),
        input.siteId,
        tenantId || null,
        input.actorId || 'dashboard',
        input.actorRole || 'admin',
        input.action,
        input.resourceType,
        input.resourceId,
        JSON.stringify(input.metadata),
      ],
    );
  }
}
