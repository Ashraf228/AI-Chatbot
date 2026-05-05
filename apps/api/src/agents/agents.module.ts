import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { SitesModule } from '../sites/sites.module';
import { ToolsModule } from '../tools/tools.module';
import { AgentsController } from './agents.controller';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentsService } from './agents.service';

@Module({
  imports: [SitesModule, SiteModulesModule, ToolsModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentOrchestratorService, PrismaService],
  exports: [AgentsService],
})
export class AgentsModule {}
