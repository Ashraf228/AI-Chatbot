import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
  providers: [PrismaService],
})
export class AuditLogsModule {}
