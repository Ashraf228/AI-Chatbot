import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestService } from './ingest.service';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AdminScopeService } from '../utils/admin-scope.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UsageLimitService } from '../billing/usage-limit.service';

class FaqItemDto {
  @IsString()
  @MaxLength(500)
  q!: string;

  @IsString()
  @MaxLength(4000)
  a!: string;
}

class IngestFaqDto {
  @IsString()
  @MaxLength(120)
  siteId!: string;

  @IsString()
  @MaxLength(255)
  title = 'FAQ';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqItemDto)
  items!: FaqItemDto[];
}

class UpdateFaqItemDto {
  @IsString()
  @MaxLength(500)
  q!: string;

  @IsString()
  @MaxLength(4000)
  a!: string;
}

class ManualKnowledgeDto {
  @IsString()
  @MaxLength(120)
  siteId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsString()
  @MaxLength(500)
  question?: string;

  @IsString()
  @MaxLength(12000)
  content!: string;

  @IsArray()
  tags?: string[];
}

class UrlKnowledgeDto {
  @IsString()
  @MaxLength(120)
  siteId!: string;

  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsString()
  @MaxLength(255)
  title?: string;
}

class SourceActiveDto {
  isActive!: boolean;
}

export const PDF_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
  fileFilter: (_req: unknown, file: { mimetype: string }, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new BadRequestException('Only PDF files are allowed'), false);
    }
    cb(null, true);
  },
};

@UseGuards(AdminKeyGuard)
@Controller('admin/ingest')
export class IngestController {
  constructor(
    private ingest: IngestService,
    private auditLogs: AuditLogService,
    private scope: AdminScopeService,
    private rateLimit: RateLimitService,
    private usageLimits: UsageLimitService,
  ) {}

  @Get('knowledge')
  async listKnowledge(@Query('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.ingest.listKnowledge(siteId);
  }

  @Get('sources')
  async listSources(@Query('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.ingest.listSources(siteId);
  }

  @Delete('knowledge/:documentId')
  async deleteKnowledge(
    @Param('documentId') documentId: string,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    await this.scope.assertKnowledgeDocumentAccess(this.scope.getAuth(req), documentId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.ingest.deleteKnowledge(documentId);
    await this.auditLogs.record({
      siteId: result.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'delete_knowledge_source',
      resourceType: 'knowledge_document',
      resourceId: documentId,
      metadata: {
        documentId,
      },
    });
    return result;
  }

  @Delete('sources/:sourceId')
  async deleteSource(
    @Param('sourceId') sourceId: string,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const current = await this.ingest.getSource(sourceId);
    await this.scope.assertSiteAccess(this.scope.getAuth(req), current.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const source = await this.ingest.deleteSource(sourceId);
    await this.auditLogs.record({
      siteId: source.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'delete_knowledge_source',
      resourceType: 'knowledge_source',
      resourceId: sourceId,
      metadata: { sourceId },
    });
    return source;
  }

  @Patch('sources/:sourceId/active')
  async setSourceActive(
    @Param('sourceId') sourceId: string,
    @Body() body: SourceActiveDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const current = await this.ingest.getSource(sourceId);
    await this.scope.assertSiteAccess(this.scope.getAuth(req), current.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.ingest.setSourceActive(sourceId, body.isActive === true);
    await this.auditLogs.record({
      siteId: result.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: body.isActive === true ? 'enable_knowledge_source' : 'disable_knowledge_source',
      resourceType: 'knowledge_source',
      resourceId: sourceId,
      metadata: { isActive: body.isActive === true },
    });
    return result;
  }

  @Post('sources/:sourceId/resync')
  async resyncSource(
    @Param('sourceId') sourceId: string,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const current = await this.ingest.getSource(sourceId);
    await this.scope.assertSiteAccess(this.scope.getAuth(req), current.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.ingest.resyncSource(sourceId);
    await this.auditLogs.record({
      siteId: result.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'resync_knowledge_source',
      resourceType: 'knowledge_source',
      resourceId: sourceId,
      metadata: {
        sourceId,
        documentId: result.documentId,
        chunks: result.chunks,
      },
    });
    return result;
  }

  @Patch('faq/:chunkId')
  async updateFaqItem(
    @Param('chunkId') chunkId: string,
    @Body() body: UpdateFaqItemDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    await this.scope.assertFaqChunkAccess(this.scope.getAuth(req), chunkId, {
      allowedRoles: ['admin', 'operator'],
    });
    const result = await this.ingest.updateFaqItem(chunkId, body.q, body.a);
    await this.auditLogs.record({
      siteId: result.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'update_knowledge_source',
      resourceType: 'faq_chunk',
      resourceId: chunkId,
      metadata: {
        question: result.question,
      },
    });
    return result;
  }

  // FAQ import: { siteId, title, items: [{q,a}] }
  @Post('faq')
  async faq(
    @Body() body: IngestFaqDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const site = await this.scope.assertSiteAccess(this.scope.getAuth(req), body.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.usageLimits.assertWithinLimit(site.tenant_id, 'maxKnowledgeSources');
    const result = await this.ingest.ingestFaq(body.siteId, body.title ?? 'FAQ', body.items ?? []);
    await this.auditLogs.record({
      siteId: body.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'ingest_faq',
      resourceType: 'knowledge_document',
      resourceId: result.documentId,
      metadata: {
        type: 'faq',
        title: body.title ?? 'FAQ',
        itemCount: body.items?.length || 0,
      },
    });
    return result;
  }

  @Post('manual')
  async manual(
    @Body() body: ManualKnowledgeDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const site = await this.scope.assertSiteAccess(this.scope.getAuth(req), body.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.usageLimits.assertWithinLimit(site.tenant_id, 'maxKnowledgeSources');
    const result = await this.ingest.ingestManual(body.siteId, {
      title: body.title,
      question: body.question,
      content: body.content,
      tags: body.tags || [],
    });
    await this.auditLogs.record({
      siteId: body.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'ingest_manual_knowledge',
      resourceType: 'knowledge_source',
      resourceId: result.sourceId,
      metadata: {
        title: body.title,
        hasQuestion: Boolean(body.question),
      },
    });
    return result;
  }

  @Post('url')
  async url(
    @Body() body: UrlKnowledgeDto,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    const auth = this.scope.getAuth(req);
    const site = await this.scope.assertSiteAccess(auth, body.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.usageLimits.assertWithinLimit(site.tenant_id, 'maxKnowledgeSources');
    await this.enforceAdminRateLimit(`url-ingest:${body.siteId}:${auth.actorId || 'dashboard'}`, 12, 60_000);
    const result = await this.ingest.ingestUrl(body.siteId, body.url, body.title);
    await this.auditLogs.record({
      siteId: body.siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'ingest_url',
      resourceType: 'knowledge_source',
      resourceId: result.sourceId,
      metadata: {
        url: body.url,
        title: body.title || '',
      },
    });
    return result;
  }

  private async enforceAdminRateLimit(key: string, limit: number, windowMs: number) {
    const result = await this.rateLimit.allow(`admin:${key}`, limit, windowMs);
    if (!result.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  // PDF upload: multipart/form-data: file + siteId
  @Post('pdf')
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_OPTIONS))
  async pdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
    @Req() req: { dashboardAuth?: { actorId?: string; role?: string } },
  ) {
    if (!siteId?.trim()) {
      throw new BadRequestException('siteId missing');
    }

    if (!file) {
      throw new BadRequestException('file missing');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('uploaded PDF is empty or buffer missing');
    }

    const site = await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });
    await this.usageLimits.assertWithinLimit(site.tenant_id, 'maxKnowledgeSources');

    const result = await this.ingest.ingestPdf(siteId, file);
    await this.auditLogs.record({
      siteId,
      actorId: req.dashboardAuth?.actorId,
      actorRole: req.dashboardAuth?.role,
      action: 'upload_pdf',
      resourceType: 'knowledge_document',
      resourceId: result.documentId,
      metadata: {
        type: 'pdf',
        filename: file.originalname,
        chunks: result.chunks,
      },
    });
    return result;
  }
}
