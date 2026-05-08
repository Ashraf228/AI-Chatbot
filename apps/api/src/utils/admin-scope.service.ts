import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { type DashboardRole } from './dashboard-rbac';

export type DashboardAuthContext = {
  role?: DashboardRole | 'viewer' | string | null;
  actorId?: string | null;
  tenantId?: string | null;
  authMode?: string | null;
};

type SiteScopeRow = {
  id: string;
  tenant_id: string | null;
};

type AccessOptions = {
  allowedRoles?: Array<DashboardRole | 'viewer'>;
};

@Injectable()
export class AdminScopeService {
  constructor(private readonly db: PrismaService) {}

  getAuth(req: { dashboardAuth?: unknown } | undefined): DashboardAuthContext {
    const auth = req?.dashboardAuth;
    if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
      return { role: 'operator', actorId: 'dashboard', tenantId: null };
    }

    return auth as DashboardAuthContext;
  }

  assertRole(auth: DashboardAuthContext, allowedRoles: Array<DashboardRole | 'viewer'>) {
    const role = auth.role || 'operator';
    if (role === 'admin') {
      return;
    }

    if (!allowedRoles.includes(role as DashboardRole | 'viewer')) {
      throw new ForbiddenException('Forbidden');
    }

    this.assertTenantContext(auth);
  }

  async assertTenantAccess(auth: DashboardAuthContext, tenantId: string | null | undefined) {
    if (!tenantId) {
      throw new NotFoundException('Not found');
    }

    if (auth.role === 'admin') {
      return;
    }

    this.assertTenantContext(auth);

    if (auth.tenantId === tenantId) {
      return;
    }

    throw new ForbiddenException('Forbidden');
  }

  async assertSiteAccess(
    auth: DashboardAuthContext,
    siteId: string,
    options: AccessOptions = {},
  ): Promise<SiteScopeRow> {
    const allowedRoles = options.allowedRoles || ['admin', 'operator', 'customer'];
    this.assertRole(auth, allowedRoles);

    const site = await this.findSite(siteId);
    if (!site) {
      throw new NotFoundException('Not found');
    }

    if (auth.role === 'admin') {
      return site;
    }

    this.assertTenantContext(auth);

    if (site.tenant_id !== auth.tenantId) {
      throw new ForbiddenException('Forbidden');
    }

    return site;
  }

  async assertAgentRunAccess(auth: DashboardAuthContext, runId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('agent_runs', runId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertAgentTicketAccess(auth: DashboardAuthContext, ticketId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('agent_tickets', ticketId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertWebhookJobAccess(auth: DashboardAuthContext, jobId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('webhook_jobs', jobId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertKnowledgeDocumentAccess(auth: DashboardAuthContext, documentId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('documents', documentId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertLeadAccess(auth: DashboardAuthContext, leadId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('widget_leads', leadId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertConversationAccess(auth: DashboardAuthContext, conversationId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('conversations', conversationId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertReportSubscriptionAccess(auth: DashboardAuthContext, subscriptionId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('report_subscriptions', subscriptionId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertReportRunAccess(auth: DashboardAuthContext, reportRunId: string, options: AccessOptions = {}) {
    const row = await this.findResourceSite('report_runs', reportRunId);
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  async assertFaqChunkAccess(auth: DashboardAuthContext, chunkId: string, options: AccessOptions = {}) {
    const res = await this.db.query<{ site_id: string }>(
      `SELECT d.site_id
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.id = $1
       LIMIT 1`,
      [chunkId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new NotFoundException('Not found');
    }
    return this.assertSiteAccess(auth, row.site_id, options);
  }

  filterSitesForAuth<T extends { tenant_id?: string | null; tenantId?: string | null }>(
    auth: DashboardAuthContext,
    sites: T[],
  ): T[] {
    if (auth.role === 'admin' || !auth.tenantId) {
      if (auth.role === 'admin') {
        return sites;
      }

      this.assertTenantContext(auth);
    }

    return sites.filter((site) => (site.tenantId || site.tenant_id || null) === auth.tenantId);
  }

  private assertTenantContext(auth: DashboardAuthContext) {
    if (auth.role === 'admin') {
      return;
    }

    if (!auth.tenantId) {
      throw new ForbiddenException('Forbidden');
    }
  }

  private async findSite(siteId: string): Promise<SiteScopeRow | null> {
    const res = await this.db.query<SiteScopeRow>(
      `SELECT id, tenant_id FROM sites WHERE id = $1 LIMIT 1`,
      [siteId],
    );
    return res.rows[0] || null;
  }

  private async findResourceSite(
    table:
      | 'agent_runs'
      | 'agent_tickets'
      | 'webhook_jobs'
      | 'documents'
      | 'conversations'
      | 'widget_leads'
      | 'report_subscriptions'
      | 'report_runs',
    id: string,
  ) {
    const res = await this.db.query<{ site_id: string }>(
      `SELECT site_id FROM ${table} WHERE id = $1 LIMIT 1`,
      [id],
    );
    return res.rows[0] || null;
  }
}
