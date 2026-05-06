import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
