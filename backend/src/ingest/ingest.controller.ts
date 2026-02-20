import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IngestService } from './ingest.service';

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
  @UseInterceptors(FileInterceptor('file'))
  async pdf(@UploadedFile() file: any, @Body() body: any) {
    return this.ingest.ingestPdf(body.siteId, file);
  }
}