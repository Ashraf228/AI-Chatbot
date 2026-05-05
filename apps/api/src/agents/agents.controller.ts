import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AgentsService } from './agents.service';
import {
  CreateAgentRunDto,
  CreateToolInvocationDto,
  ExecuteAgentRunDto,
  ExecuteExistingAgentRunDto,
  UpdateAgentTicketStatusDto,
} from './dto';
import { ToolDispatcherService } from '../tools/tool-dispatcher.service';
import { AgentOrchestratorService } from './agent-orchestrator.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/agents')
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly tools: ToolDispatcherService,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  @Get(':siteId')
  async getOverview(@Param('siteId') siteId: string) {
    return this.agents.getOverview(siteId);
  }

  @Post(':siteId/runs')
  async createRun(@Param('siteId') siteId: string, @Body() body: CreateAgentRunDto) {
    return this.agents.createRun(siteId, body);
  }

  @Post(':siteId/execute')
  async executeAgent(@Param('siteId') siteId: string, @Body() body: ExecuteAgentRunDto) {
    return this.orchestrator.createAndExecute(siteId, body);
  }

  @Get('runs/:runId/tools')
  async listToolInvocations(@Param('runId') runId: string) {
    return this.agents.listToolInvocations(runId);
  }

  @Post('runs/:runId/tools')
  async recordToolInvocation(
    @Param('runId') runId: string,
    @Body() body: CreateToolInvocationDto,
  ) {
    return this.tools.execute(runId, body);
  }

  @Post('runs/:runId/execute')
  async executeRun(
    @Param('runId') runId: string,
    @Body() body: ExecuteExistingAgentRunDto,
  ) {
    return this.orchestrator.executeExistingRun(runId, body);
  }

  @Post('tickets/:ticketId/status')
  async updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateAgentTicketStatusDto,
  ) {
    return this.agents.updateTicketStatus(ticketId, body.status);
  }

  @Post('webhooks/:jobId/retry')
  async retryWebhookJob(@Param('jobId') jobId: string) {
    return this.agents.retryWebhookJob(jobId);
  }
}
