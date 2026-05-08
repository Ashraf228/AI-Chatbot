import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

@UseGuards(AdminKeyGuard)
@Controller('admin/ingest')
export class IngestController {
  constructor(
    private ingest: IngestService,
    private auditLogs: AuditLogService,
    private scope: AdminScopeService,
  ) {}

  @Get('knowledge')
  async listKnowledge(@Query('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer', 'viewer'],
    });
    return this.ingest.listKnowledge(siteId);
  }

  @Get('sources')
  async listSources(@Query('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer', 'viewer'],
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
    await this.scope.assertSiteAccess(this.scope.getAuth(req), body.siteId, {
      allowedRoles: ['admin', 'operator'],
    });
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

  // PDF upload: multipart/form-data: file + siteId
  @Post('pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 15 * 1024 * 1024, // 15 MB
      },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
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

    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator'],
    });

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
