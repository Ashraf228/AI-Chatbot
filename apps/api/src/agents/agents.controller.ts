import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import { AdminScopeService } from '../utils/admin-scope.service';

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('admin')
@Controller('admin/agents')
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly tools: ToolDispatcherService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly scope: AdminScopeService,
  ) {}

  @Get(':siteId')
  async getOverview(@Param('siteId') siteId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin'],
    });
    return this.agents.getOverview(siteId);
  }

  @Post(':siteId/runs')
  async createRun(
    @Param('siteId') siteId: string,
    @Body() body: CreateAgentRunDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin'],
    });
    return this.agents.createRun(siteId, body);
  }

  @Post(':siteId/execute')
  async executeAgent(
    @Param('siteId') siteId: string,
    @Body() body: ExecuteAgentRunDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin'],
    });
    return this.orchestrator.createAndExecute(siteId, body);
  }

  @Get('runs/:runId/tools')
  async listToolInvocations(@Param('runId') runId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertAgentRunAccess(this.scope.getAuth(req), runId, {
      allowedRoles: ['admin'],
    });
    return this.agents.listToolInvocations(runId);
  }

  @Post('runs/:runId/tools')
  async recordToolInvocation(
    @Param('runId') runId: string,
    @Body() body: CreateToolInvocationDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertAgentRunAccess(this.scope.getAuth(req), runId, {
      allowedRoles: ['admin'],
    });
    return this.tools.execute(runId, body);
  }

  @Post('runs/:runId/execute')
  async executeRun(
    @Param('runId') runId: string,
    @Body() body: ExecuteExistingAgentRunDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertAgentRunAccess(this.scope.getAuth(req), runId, {
      allowedRoles: ['admin'],
    });
    return this.orchestrator.executeExistingRun(runId, body);
  }

  @Post('tickets/:ticketId/status')
  async updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateAgentTicketStatusDto,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    await this.scope.assertAgentTicketAccess(this.scope.getAuth(req), ticketId, {
      allowedRoles: ['admin'],
    });
    return this.agents.updateTicketStatus(ticketId, body.status);
  }

  @Post('webhooks/:jobId/retry')
  async retryWebhookJob(@Param('jobId') jobId: string, @Req() req: { dashboardAuth?: unknown }) {
    await this.scope.assertWebhookJobAccess(this.scope.getAuth(req), jobId, {
      allowedRoles: ['admin'],
    });
    return this.agents.retryWebhookJob(jobId);
  }
}
