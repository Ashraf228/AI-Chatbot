import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestService } from './ingest.service';
import { AdminKeyGuard } from '../utils/admin.guard';

@UseGuards(AdminKeyGuard)
@Controller('admin/ingest')
export class IngestController {
  constructor(private ingest: IngestService) {}

  // FAQ import: { siteId, title, items: [{q,a}] }
  @Post('faq')
  async faq(@Body() body: any) {
    return this.ingest.ingestFaq(body.siteId, body.title ?? 'FAQ', body.items ?? []);
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
          return cb(new BadRequestException('Only PDF files are allowed') as any, false);
        }
        cb(null, true);
      },
    }),
  )
  async pdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('siteId') siteId: string,
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

    return this.ingest.ingestPdf(siteId, file);
  }
}