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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestService } from './ingest.service';
import { AdminKeyGuard } from '../utils/admin.guard';
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
  constructor(private ingest: IngestService) {}

  @Get('knowledge')
  async listKnowledge(@Query('siteId') siteId: string) {
    return this.ingest.listKnowledge(siteId);
  }

  @Delete('knowledge/:documentId')
  async deleteKnowledge(@Param('documentId') documentId: string) {
    return this.ingest.deleteKnowledge(documentId);
  }

  @Patch('faq/:chunkId')
  async updateFaqItem(@Param('chunkId') chunkId: string, @Body() body: UpdateFaqItemDto) {
    return this.ingest.updateFaqItem(chunkId, body.q, body.a);
  }

  // FAQ import: { siteId, title, items: [{q,a}] }
  @Post('faq')
  async faq(@Body() body: IngestFaqDto) {
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
          return cb(new BadRequestException('Only PDF files are allowed'), false);
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
