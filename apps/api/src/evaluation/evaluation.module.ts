import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ChatPipelineModule } from '../ai/chat-pipeline/chat-pipeline.module';
import { PrismaService } from '../db/prisma.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { AdminScopeModule } from '../utils/admin-scope.module';
import { EvaluationAccessService } from './evaluation-access.service';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';

@Module({
  imports: [AdminScopeModule, AuditLogsModule, ChatPipelineModule],
  controllers: [EvaluationController],
  providers: [EvaluationAccessService, EvaluationService, PrismaService, RateLimitService],
  exports: [EvaluationAccessService],
})
export class EvaluationModule {}
