import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import { AdminScopeService } from '../utils/admin-scope.service';
import { EvaluationAccessService } from './evaluation-access.service';
import { EvaluationService } from './evaluation.service';

function resolveClientIp(req: { ip?: string; headers?: Record<string, unknown> }) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip || 'unknown';
}

@UseGuards(AdminKeyGuard)
@RequireDashboardRoles('viewer')
@Controller('admin/evaluation')
export class EvaluationController {
  constructor(
    private readonly scope: AdminScopeService,
    private readonly access: EvaluationAccessService,
    private readonly evaluation: EvaluationService,
  ) {}

  @Get('context')
  async context(@Req() req: { dashboardAuth?: unknown }) {
    const access = await this.access.resolve(this.scope.getAuth(req));
    return this.evaluation.context(access);
  }

  @Post('chat/session')
  async createChatSession(@Req() req: { dashboardAuth?: unknown }, @Body() body: Record<string, unknown>) {
    const access = await this.access.resolve(this.scope.getAuth(req));
    return this.evaluation.createChatSession(access, body || {});
  }

  @Post('chat/message')
  async sendMessage(
    @Req() req: { dashboardAuth?: unknown; ip?: string; headers?: Record<string, unknown> },
    @Body() body: Record<string, unknown>,
  ) {
    const access = await this.access.resolve(this.scope.getAuth(req));
    return this.evaluation.sendMessage(access, body || {}, resolveClientIp(req));
  }
}
