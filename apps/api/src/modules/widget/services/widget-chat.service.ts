import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

import { ChatPipelineService } from '../../../ai/chat-pipeline/chat-pipeline.service';
import { ChatPipelineEvent } from '../../../ai/chat-pipeline/chat-pipeline-events';
import { PrismaService } from '../../../db/prisma.service';
import { SendMessageDto } from '../dto/send-message.dto';
import {
  ConversationMessageEntity,
  ConversationMessageRole,
} from '../entities/conversation-message.entity';
import { WidgetConfigService } from './widget-config.service';
import { WidgetSecurityService } from './widget-security.service';

type MessageRow = {
  id: string;
  session_id: string;
  role: ConversationMessageRole;
  content: string;
  created_at: string;
};

@Injectable()
export class WidgetChatService {
  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  constructor(
    private readonly widgetConfigService: WidgetConfigService,
    private readonly db: PrismaService,
    private readonly widgetSecurityService: WidgetSecurityService,
    private readonly chatPipeline: ChatPipelineService,
  ) {}

  async sendMessage(dto: SendMessageDto, origin?: string, req?: Request) {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin, req?.headers.referer as string | undefined);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);

    const tenantId = site.tenantId || '';
    if (!tenantId) {
      throw new Error('Site misconfigured (tenant missing)');
    }

    const reply = await this.chatPipeline.process({
      tenantId,
      siteId: site.id,
      sessionId: dto.sessionId,
      message: dto.message,
      source: 'widget',
      systemPrompt: site.systemPrompt,
      conversationFlow: site.conversationFlow,
      sourceUrl: req?.headers.referer as string | undefined,
    });

    const rows = await this.db.query<MessageRow>(
      `SELECT m.id, c.session_id, m.role, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.site_id = $1 AND c.session_id = $2
       ORDER BY m.created_at DESC
       LIMIT 2`,
      [site.id, reply.sessionId],
    );

    const messages: ConversationMessageEntity[] = rows.rows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        tokens: 0,
        createdAt: new Date(row.created_at).toISOString(),
      }));

    return {
      sessionId: reply.sessionId,
      answer: reply.answer,
      parts: reply.parts || [],
      sources: reply.sources || [],
      messages,
    };
  }

  async streamMessage(
    dto: SendMessageDto,
    origin: string | undefined,
    req: Request | undefined,
    res: Response,
  ) {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin, req?.headers.referer as string | undefined);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);
    await this.widgetSecurityService.enforceRateLimit(
      `${dto.siteKey}:stream:${this.widgetSecurityService.getClientIp(req)}`,
      20,
      60_000,
    );

    const tenantId = site.tenantId || '';
    if (!tenantId) {
      throw new Error('Site misconfigured (tenant missing)');
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`${JSON.stringify(payload)}\n`);
    };

    try {
      await this.chatPipeline.stream(
        {
          tenantId,
          siteId: site.id,
          sessionId: dto.sessionId,
          message: dto.message,
          source: 'widget',
          systemPrompt: site.systemPrompt,
          conversationFlow: site.conversationFlow,
          sourceUrl: req?.headers.referer as string | undefined,
        },
        async (event) => this.writeLegacyStreamEvent(event, writeEvent),
      );
    } catch (error: unknown) {
      writeEvent({
        type: 'error',
        message: this.getErrorMessage(error, 'Streaming failed'),
      });
    } finally {
      res.end();
    }
  }

  private writeLegacyStreamEvent(
    event: ChatPipelineEvent,
    writeEvent: (payload: Record<string, unknown>) => void,
  ) {
    switch (event.type) {
      case 'message_start':
        writeEvent({ type: 'start', sessionId: event.sessionId });
        return;
      case 'token':
        writeEvent({ type: 'chunk', delta: event.delta });
        return;
      case 'message_end':
        writeEvent({
          type: 'done',
          answer: event.answer,
          sessionId: event.sessionId,
          parts: event.parts,
          sources: event.sources,
          toolResults: event.toolResults || [],
        });
        return;
      case 'error':
        writeEvent({ type: 'error', message: event.message });
        return;
      case 'sources':
      case 'tool_event':
      case 'lead_event':
      default:
        return;
    }
  }
}
