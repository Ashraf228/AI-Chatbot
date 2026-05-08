import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaService } from '../db/prisma.service';
import { SiteDataController } from './site-data.controller';
import { SiteDataExportService } from './site-data-export.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [SiteDataController],
  providers: [SiteDataExportService, PrismaService],
})
export class SiteDataModule {}
