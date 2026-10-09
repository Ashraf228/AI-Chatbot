import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../../utils/admin.guard';
import { AdminScopeService } from '../../utils/admin-scope.service';
import { ItSupportTicketsService } from './it-support-tickets.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/sites/:siteId/it-support/tickets')
export class ItSupportTicketsController {
  constructor(
    private readonly scope: AdminScopeService,
    private readonly tickets: ItSupportTicketsService,
  ) {}

  @Get()
  async listTickets(
    @Param('siteId') siteId: string,
    @Query() query: Record<string, string | undefined>,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const site = await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.tickets.listItSupportTickets({
      tenantId: site.tenant_id,
      siteId,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      priority: query.priority,
      issueType: query.issueType,
      status: query.status,
      forwardingStatus: query.forwardingStatus,
      from: query.from,
      to: query.to,
    });
  }

  @Get(':ticketId')
  async getTicket(
    @Param('siteId') siteId: string,
    @Param('ticketId') ticketId: string,
    @Req() req: { dashboardAuth?: unknown },
  ) {
    const site = await this.scope.assertSiteAccess(this.scope.getAuth(req), siteId, {
      allowedRoles: ['admin', 'operator', 'customer'],
    });
    return this.tickets.getItSupportTicket({
      tenantId: site.tenant_id,
      siteId,
      ticketId,
    });
  }
}
