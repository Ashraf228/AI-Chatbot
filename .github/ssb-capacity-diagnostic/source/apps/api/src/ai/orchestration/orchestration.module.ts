import { Module } from '@nestjs/common';

import { PrismaService } from '../../db/prisma.service';
import { SiteModulesModule } from '../../site-modules/site-modules.module';
import { AgentMemoryService } from './agent-memory.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentPolicyService } from './agent-policy.service';
import { AgentRunLoggerService } from './agent-run-logger.service';

@Module({
  imports: [SiteModulesModule],
  providers: [
    AgentOrchestratorService,
    AgentPolicyService,
    AgentMemoryService,
    AgentRunLoggerService,
    PrismaService,
  ],
  exports: [AgentOrchestratorService, AgentPolicyService, AgentMemoryService, AgentRunLoggerService],
})
export class OrchestrationModule {}
