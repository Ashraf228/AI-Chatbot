import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../db/prisma.service';
import { redactPII } from '../../utils/pii';
import { logEvent } from '../../utils/logger';
import { ChatPipelineHistoryEntry } from './chat-pipeline.types';

@Injectable()
export class ConversationStateService {
  constructor(private readonly db: PrismaService) {}

  async ensureConversation(params: {
    tenantId: string;
    siteId: string;
    sessionId?: string;
  }) {
    const sessionId = params.sessionId?.trim() || randomUUID();
    const existing = await this.db.query<{ id: string }>(
      `SELECT id
       FROM conversations
       WHERE tenant_id = $1 AND site_id = $2 AND session_id = $3
       LIMIT 1`,
      [params.tenantId, params.siteId, sessionId],
    );

    const existingId = existing.rows[0]?.id;
    if (existingId) {
      return { id: existingId, sessionId };
    }

    const conversationId = randomUUID();
    await this.db.query(
      `INSERT INTO conversations(id, tenant_id, site_id, session_id)
       VALUES ($1, $2, $3, $4)`,
      [conversationId, params.tenantId, params.siteId, sessionId],
    );

    logEvent('conversation_created', {
      conversationId,
      tenantId: params.tenantId,
      siteId: params.siteId,
      sessionId,
    });

    return { id: conversationId, sessionId };
  }

  async appendMessage(params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    redact?: boolean;
  }) {
    const content = params.redact ? redactPII(params.content) : params.content;
    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), params.conversationId, params.role, content],
    );
  }

  async loadHistory(conversationId: string, limit = 6): Promise<ChatPipelineHistoryEntry[]> {
    const historyRes = await this.db.query<ChatPipelineHistoryEntry>(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit],
    );

    return historyRes.rows.slice().reverse();
  }

  async touchConversation(conversationId: string) {
    await this.db.query(
      `UPDATE conversations
       SET last_active_at = now()
       WHERE id = $1`,
      [conversationId],
    );
  }

  async touchWidgetSession(params: {
    siteId: string;
    sessionId: string;
    sourceUrl?: string | null;
    leadCaptured?: boolean;
  }) {
    if (typeof params.leadCaptured === 'boolean') {
      await this.db.query(
        `UPDATE widget_sessions
         SET last_seen_at = now(),
             source_url = COALESCE($3, source_url),
             lead_captured = COALESCE(lead_captured, false) OR $4::boolean
         WHERE id = $1 AND site_id = $2`,
        [params.sessionId, params.siteId, params.sourceUrl || null, params.leadCaptured],
      );
      return;
    }

    await this.db.query(
      `UPDATE widget_sessions
       SET last_seen_at = now(),
           source_url = COALESCE($3, source_url)
       WHERE id = $1 AND site_id = $2`,
      [params.sessionId, params.siteId, params.sourceUrl || null],
    );
  }
}
