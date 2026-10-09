import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../db/prisma.service';
import { Queryable } from '../db/database.service';
import { maintenanceWork, runtimeState, assertCurrentMaintenanceOwner } from '../maintenance/maintenance-runtime';
import { SitesService } from '../sites/sites.service';
import { CreateSiteDto, UpdateSiteDto } from '../sites/dto';
import { TenantsService } from '../tenants/tenants.service';
import { CreateTenantDto } from '../tenants/dto';
import { TenantUsersService } from '../tenants/tenant-users.service';
import { AuthenticateTenantUserDto, CreateTenantUserDto, UpdateTenantUserDto, SetCustomerWorkspaceAccessDto } from '../tenants/tenant-users.dto';
import { SubscriptionService } from '../billing/subscription.service';
import { UsageLimitService } from '../billing/usage-limit.service';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { AdminScopeService, DashboardAuthContext } from '../utils/admin-scope.service';
import { KnowledgeSourcesService } from '../knowledge-sources/knowledge-sources.service';
import { ItKnowledgeTemplateImportService } from '../modules/it-support/it-knowledge-template-import.service';
import { SiteDataExportService } from '../site-data/site-data-export.service';
import { SiteRuntimeGrantOperatorAuthService } from '../knowledge-sources/site-runtime-grant-operator-auth.service';
import { SiteRuntimeGrantWriteService, SiteRuntimeLlmGrantWriteService } from '../knowledge-sources/site-runtime-grant-write.service';
import { ProviderApprovalAuditWriter } from '../knowledge-sources/provider-approval-audit-writer.service';
import { SiteRuntimeGrantsController } from '../knowledge-sources/site-runtime-grants.controller';
import { SiteRuntimeLlmGrantsController } from '../knowledge-sources/site-runtime-llm-grants.controller';
import { verifyWriterRequest, WriterRequest } from './protocol';
import { writerRuntimeContract } from './runtime-contract';
import type { RuntimeQueryEmbeddingService } from '../knowledge-sources/runtime-query-embedding.service';
import { CustomerKnowledgeController } from '../modules/it-support/customer-knowledge.controller';
import { CustomerKnowledgePoweruserAuthService } from '../modules/it-support/customer-knowledge-poweruser-auth.service';

async function dto<T extends object>(type: ClassConstructor<T>, body: object): Promise<T> {
  const input = plainToInstance(type, body);
  if ((await validate(input, { whitelist: true, forbidNonWhitelisted: true })).length) throw new BadRequestException('Invalid request');
  return input;
}

/** One request, one connection, one transaction. Existing service transactions join it. */
function transactionDatabase(client: PoolClient): PrismaService {
  let sequence = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const query = (sql: string, params?: readonly unknown[]) => {
    const result = tail.then(() => client.query(sql, params ? [...params] : undefined));
    tail = result.catch(() => undefined);
    return result;
  };
  const db = {
    query,
    transaction: async <T>(callback: (tx: Queryable) => Promise<T>) => {
      const savepoint = `writer_${++sequence}`;
      await query(`SAVEPOINT ${savepoint}`);
      try { const result = await callback(db); await query(`RELEASE SAVEPOINT ${savepoint}`); return result; }
      catch (primary) {
        try { await query(`ROLLBACK TO SAVEPOINT ${savepoint}`); await query(`RELEASE SAVEPOINT ${savepoint}`); }
        catch (cleanup) { throw new AggregateError([primary, cleanup], 'Writer savepoint rollback unverified'); }
        throw primary;
      }
    },
  };
  return db as unknown as PrismaService;
}

// Known database outcome and connection cleanup are distinct maintenance facts.
export async function writerTransaction<T>(pool: Pool, work: (db: PrismaService) => Promise<T>) {
  let client: PoolClient;
  try { client = await pool.connect(); } catch (error) { return { error }; }
  let discard = false, commitAttempted = false;
  let outcome: { result: T } | { error: unknown };
  let uncertain: unknown;
  let connectionFailure: Error | undefined;
  const onError = (error: Error) => { connectionFailure = error; discard = true; };
  client.on('error', onError);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query('SELECT pg_advisory_xact_lock(1397965313, 2)');
    assertCurrentMaintenanceOwner();
    const result = await work(transactionDatabase(client));
    if (connectionFailure) throw connectionFailure;
    assertCurrentMaintenanceOwner();
    commitAttempted = true;
    const committed = await client.query('COMMIT');
    if (committed.command !== 'COMMIT') throw new Error('Writer transaction not committed');
    outcome = { result };
    // A stale owner cannot report success, but a confirmed commit is not uncertain.
    try { assertCurrentMaintenanceOwner(); } catch (error) { outcome = { error }; }
  } catch (primary) {
    outcome = { error: primary };
    try { await client.query('ROLLBACK'); }
    catch (cleanup) { discard = true; uncertain = new AggregateError([primary,cleanup], 'Writer rollback unverified'); }
    if (commitAttempted) uncertain ||= primary;
  } finally {
    client.removeListener('error', onError);
    try { client.release(discard); }
    catch (cleanup) {
      if (uncertain) uncertain = new AggregateError([uncertain,cleanup], 'Writer release failed');
      else outcome = { error: outcome! && 'error' in outcome ? new AggregateError([outcome.error,cleanup], 'Writer release failed') : cleanup };
    }
  }
  if (uncertain) throw uncertain;
  return outcome!;
}

export class AdminWriter {
  constructor(private readonly pool: Pool, private readonly signingKey: string) {}

  async execute(payload: string, signature: string) {
    const request = verifyWriterRequest(payload, signature, this.signingKey);
    // No absent-state bypass in this separate process, including local deployments.
    if (!runtimeState()) throw new ForbiddenException('Writer binding missing');
    const outcome = await maintenanceWork('configuration', async () => {
      const snapshot = runtimeState()!.snapshot();
      if (snapshot.pilot && !snapshot.terminal && !request.path.endsWith('/revoke')) return { error: new ForbiddenException('Pilot cleanup required') };
      return writerTransaction(this.pool, async db => {
        // A consumed request survives process restart; receipt and effects commit together.
        const receipt = await db.query(
          `INSERT INTO maintenance_admin.writer_receipts(id, request_sha256) VALUES ($1,$2)
           ON CONFLICT DO NOTHING RETURNING id`,
          [request.id, createHash('sha256').update(payload).digest('hex')]);
        if (!receipt.rows.length) throw new ConflictException('Request already consumed');
        const result = await this.dispatch(db, request);
        if (Date.now() >= request.expiresAt || Date.now() >= request.session.exp) throw new ForbiddenException('Request expired');
        return result;
      });
    }, true);
    if ('error' in outcome) {
      const error = outcome.error as {code?: string; constraint?: string};
      if (error?.code === '23514' && error.constraint === 'provider_approval_grants_source_scope_check')
        throw new ConflictException('Knowledge source is referenced by a provider approval grant');
      throw outcome.error;
    }
    return outcome.result;
  }

  private async dispatch(db: PrismaService, r: WriterRequest): Promise<unknown> {
    if (r.path === '/admin/tenant-users/authenticate') return new TenantUsersService(db, new TenantsService(db))
      .authenticate(await dto(AuthenticateTenantUserDto, r.body));
    const auth: DashboardAuthContext = { role: r.session.role, actorId: r.session.sub,
      tenantId: r.session.tenantId, tenantUserId: r.session.tenantUserId, authMode: 'writer-attestation' };
    const scope = new AdminScopeService(db);
    // The dashboard signs only verified sessions; fresh principal checks still apply to personal sessions.
    if (auth.role !== 'admin') {
      if (!auth.tenantId || !auth.tenantUserId) throw new ForbiddenException('Forbidden');
      const principal = await db.query(`SELECT id FROM tenant_users WHERE id=$1 AND tenant_id=$2
        AND is_active=true AND (expires_at IS NULL OR expires_at>clock_timestamp()) FOR SHARE`, [auth.tenantUserId, auth.tenantId]);
      if (principal.rows.length !== 1) throw new ForbiddenException('Forbidden');
    }
    const tenants = new TenantsService(db);
    const subscriptions = new SubscriptionService(db);
    const limits = new UsageLimitService(db, subscriptions);
    const audit = new AuditLogService(db);
    const sites = new SitesService(db, tenants, audit, limits);
    const sources = new KnowledgeSourcesService(db, sites);
    const users = new TenantUsersService(db, tenants);
    const parts = r.path.split('/').slice(1).map(part => decodeURIComponent(part));
    const admin = () => scope.assertRole(auth, ['admin']);
    if (parts[0] === 'customer') {
      return new CustomerKnowledgeController(new CustomerKnowledgePoweruserAuthService(db),
        new ItKnowledgeTemplateImportService(db, sources, limits), audit)
        .deleteTemplate(parts[2], parts[4], { authorization: r.authorization, 'x-dashboard-token': process.env.DASHBOARD_INTERNAL_TOKEN });
    }
    if (r.path === '/admin/tenants') {
      admin(); const tenant = await tenants.createTenant(await dto(CreateTenantDto, r.body));
      await subscriptions.getCurrentSubscription(tenant.id); return tenant;
    }
    if (r.path === '/admin/tenant-users') { admin(); return users.create(await dto(CreateTenantUserDto, r.body)); }
    if (parts[1] === 'tenant-users') {
      admin();
      if (parts.length === 3) return users.update(parts[2], await dto(UpdateTenantUserDto, r.body));
      if (r.method === 'DELETE') return users.revokeCustomerWorkspaceAccess(parts[2]);
      return users.setCustomerWorkspaceAccess(parts[2], (await dto(SetCustomerWorkspaceAccessDto, r.body)).siteIds);
    }
    if (r.path === '/admin/billing/plan') {
      admin();
      if (typeof r.body.tenantId !== 'string' || typeof r.body.planCode !== 'string') throw new BadRequestException('Invalid request');
      const tenant = await tenants.ensureTenantExists(r.body.tenantId);
      return subscriptions.setPlanForTenant(tenant, r.body.planCode);
    }
    if (r.path === '/admin/sites') {
      scope.assertRole(auth, ['admin', 'operator']);
      const body = await dto(CreateSiteDto, r.body);
      await scope.assertTenantAccess(auth, body.tenantId);
      if (body.id) {
        const existing = await sites.getSite(body.id);
        if (existing && existing.tenant_id !== body.tenantId) throw new ForbiddenException('Forbidden');
      }
      return sites.createSite(body);
    }
    if (parts[1] === 'sites') {
      const siteId = parts[2];
      await db.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteId]);
      const deletingAdminData = parts.length === 3 && r.method === 'DELETE' || parts.includes('delete-data');
      const site = await scope.assertSiteAccess(auth, siteId, { allowedRoles: deletingAdminData ? ['admin'] : ['admin','operator'] });
      if (parts.length === 3 && r.method === 'DELETE') {
        if (r.body.confirmation !== 'löschen') throw new BadRequestException('Zum Löschen muss exakt "löschen" bestätigt werden.');
        // Same Site-CASCADE effect, ordered before source SET NULL / scope CHECK.
        const grants = await db.query('DELETE FROM provider_approval_grants WHERE site_id=$1 AND tenant_id=$2 RETURNING id', [siteId,site.tenant_id]);
        await audit.record({siteId,tenantId:site.tenant_id,actorId:auth.actorId,actorRole:auth.role,action:'site.grants_deleted',resourceType:'site',resourceId:siteId,metadata:{grants:grants.rows.length}});
        const result = await sites.deleteSite(siteId, {
          confirmation: r.body.confirmation, actorId: auth.actorId, actorRole: auth.role });
        return {...result,deleted:{...result.deleted,providerApprovalGrants:grants.rows.length}};
      }
      if (parts.length === 3) return sites.updateSite(siteId, await dto(UpdateSiteDto, r.body));
      const data = new SiteDataExportService(db, audit);
      if (parts[3] === 'privacy') return data.deletePrivacyData(siteId, r.body, auth);
      return data.deleteSiteData(siteId, { scope: (r.body.scope || 'all') as never, confirm: r.body.confirm as boolean }, auth);
    }
    if (parts[1] === 'ingest') {
      const id = parts[3];
      const table = parts[2] === 'sources' ? 'knowledge_sources' : 'documents';
      const loaded = await db.query<{ site_id: string; source_id?: string }>(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
      if (!loaded.rows[0]) throw new NotFoundException('Knowledge source not found');
      const siteId = loaded.rows[0].site_id;
      await scope.assertSiteAccess(auth, siteId, { allowedRoles: ['admin','operator'] });
      const sourceId = table === 'knowledge_sources' ? id : loaded.rows[0].source_id;
      if (sourceId) {
        await db.query('SELECT id FROM knowledge_sources WHERE id=$1 FOR UPDATE',[sourceId]);
        const deletingSource = table === 'knowledge_sources' || !(await db.query('SELECT id FROM documents WHERE source_id=$1 AND id<>$2 LIMIT 1',[sourceId,id])).rows.length;
        if (deletingSource && (await db.query('SELECT id FROM provider_approval_grants WHERE source_id=$1 LIMIT 1',[sourceId])).rows.length)
          throw new ConflictException('Knowledge source is referenced by a provider approval grant');
      }
      let result;
      if (table === 'knowledge_sources') result = await sources.deleteSource(id);
      else {
        if (loaded.rows[0].source_id) await db.query('SELECT id FROM knowledge_sources WHERE id=$1 FOR UPDATE', [loaded.rows[0].source_id]);
        await db.query('DELETE FROM documents WHERE id=$1', [id]);
        await sources.deleteIfUnused(loaded.rows[0].source_id || '');
        result = { ok: true, deletedId: id, siteId };
      }
      await audit.record({ siteId, actorId: auth.actorId, actorRole: auth.role, action: 'delete_knowledge_source',
        resourceType: table === 'documents' ? 'knowledge_document' : 'knowledge_source', resourceId: id,
        metadata: table === 'documents' ? { documentId: id } : { sourceId: id } });
      return result;
    }
    if (parts[0] === 'internal') {
      const grantAuth = new SiteRuntimeGrantOperatorAuthService(db);
      const auditWriter = new ProviderApprovalAuditWriter();
      const controller = parts[1] === 'site-runtime-grants'
        ? new SiteRuntimeGrantsController(grantAuth, new SiteRuntimeGrantWriteService(db, auditWriter, {
          resolveRuntimeContract: () => writerRuntimeContract('query_embedding'),
        } as RuntimeQueryEmbeddingService))
        : new SiteRuntimeLlmGrantsController(grantAuth, SiteRuntimeLlmGrantWriteService.forAdministrativeRuntime(db, auditWriter,
          () => writerRuntimeContract('llm_generation')));
      const args = [parts[2], parts[3], r.authorization, process.env.DASHBOARD_INTERNAL_TOKEN] as const;
      if (parts.length === 6) return controller.revoke(args[0], args[1], parts[4], args[2], args[3], r.body);
      return controller.create(...args, r.body);
    }
    throw new BadRequestException('Unsupported operation');
  }
}
