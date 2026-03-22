import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminKeyGuard } from '../utils/admin.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/conversations')
export class ConversationsController {
  constructor(private db: PrismaService) {}

  @Get()
  async list(@Query('siteId') siteId?: string) {
    const params: any[] = [];
    let where = '';

    if (siteId) {
      params.push(siteId);
      where = `WHERE c.site_id = $1`;
    }

    const res = await this.db.query(
      `
      SELECT
        c.id,
        c.tenant_id,
        c.site_id,
        c.session_id,
        c.created_at,
        c.last_active_at,
        COUNT(m.id) AS message_count
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

  @Get(':id')
  async detail(@Param('id') id: string) {
    const conv = await this.db.query(
      `SELECT * FROM conversations WHERE id = $1 LIMIT 1`,
      [id],
    );

    if (!conv.rows[0]) {
      return { message: 'Conversation not found' };
    }

    const msgs = await this.db.query(
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
}