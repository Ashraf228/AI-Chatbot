import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminScopeModule } from '../utils/admin-scope.module';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [AdminScopeModule],
  controllers: [AuditLogsController],
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
