import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { SiteRuntimeGrantOperatorAuthService } from './site-runtime-grant-operator-auth.service';
import {
  SiteRuntimeLlmGrantWriteService,
  type SiteRuntimeGrantCreateResult,
  type SiteRuntimeGrantPreviewResult,
  type SiteRuntimeGrantRevokeResult,
  type SiteRuntimeGrantStatusResult,
} from './site-runtime-grant-write.service';

const GRANT_TERM_FIELDS = new Set([
  'validFrom',
  'expiresAt',
  'embeddingDimension',
  'providerRegion',
  'dataCategories',
  'customerDataApproved',
  'productionApproved',
  'providerDpaApproved',
  'retentionPolicy',
  'redactionPolicy',
  'loggingPolicy',
  'deletionPolicy',
  'reindexPolicy',
  'rateLimit',
  'costLimit',
  'approvalEvidenceRef',
]);
const REVOKE_FIELDS = new Set(['revocationReason']);

type GrantWriteResult =
  | SiteRuntimeGrantPreviewResult
  | SiteRuntimeGrantCreateResult
  | SiteRuntimeGrantRevokeResult
  | SiteRuntimeGrantStatusResult;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function assertBodyFields(value: unknown, allowedFields: Set<string>): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some((key) => !allowedFields.has(key))) {
    throw new BadRequestException('Invalid request');
  }
}

function projectWriteResult<T extends GrantWriteResult>(result: T): T {
  switch (result.kind) {
    case 'invalid_terms':
      throw new BadRequestException('Invalid request');
    case 'unsupported_runtime_configuration':
      throw new ConflictException('Runtime unavailable');
    case 'not_found':
      throw new NotFoundException('Not found');
    case 'would_conflict':
    case 'conflict':
      throw new ConflictException('Grant conflict');
    case 'invalid_context':
      throw new InternalServerErrorException('Internal server error');
    default:
      return result;
  }
}

@Controller('internal/site-runtime-llm-grants')
export class SiteRuntimeLlmGrantsController {
  constructor(
    private readonly auth: SiteRuntimeGrantOperatorAuthService,
    private readonly grants: SiteRuntimeLlmGrantWriteService,
  ) {}

  @Post(':tenantId/:siteId/preview')
  @HttpCode(200)
  async preview(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
    @Headers('authorization') authorizationHeader: unknown,
    @Headers('x-dashboard-token') dashboardTokenHeader: unknown,
    @Body() body: unknown,
  ) {
    const context = await this.authorize(
      tenantId,
      siteId,
      authorizationHeader,
      dashboardTokenHeader,
    );
    assertBodyFields(body, GRANT_TERM_FIELDS);
    return projectWriteResult(await this.grants.preview(context, body));
  }

  @Post(':tenantId/:siteId')
  async create(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
    @Headers('authorization') authorizationHeader: unknown,
    @Headers('x-dashboard-token') dashboardTokenHeader: unknown,
    @Body() body: unknown,
  ) {
    const context = await this.authorize(
      tenantId,
      siteId,
      authorizationHeader,
      dashboardTokenHeader,
    );
    assertBodyFields(body, GRANT_TERM_FIELDS);
    return projectWriteResult(await this.grants.create(context, body));
  }

  @Post(':tenantId/:siteId/:grantId/revoke')
  @HttpCode(200)
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
    @Param('grantId') grantId: string,
    @Headers('authorization') authorizationHeader: unknown,
    @Headers('x-dashboard-token') dashboardTokenHeader: unknown,
    @Body() body: unknown,
  ) {
    const context = await this.authorize(
      tenantId,
      siteId,
      authorizationHeader,
      dashboardTokenHeader,
    );
    assertBodyFields(body, REVOKE_FIELDS);
    return projectWriteResult(await this.grants.revoke(context, {
      grantId,
      revocationReason: body.revocationReason,
    }));
  }

  @Get(':tenantId/:siteId/:grantId')
  async status(
    @Param('tenantId') tenantId: string,
    @Param('siteId') siteId: string,
    @Param('grantId') grantId: string,
    @Headers('authorization') authorizationHeader: unknown,
    @Headers('x-dashboard-token') dashboardTokenHeader: unknown,
  ) {
    const context = await this.authorize(
      tenantId,
      siteId,
      authorizationHeader,
      dashboardTokenHeader,
    );
    return projectWriteResult(await this.grants.status(context, grantId));
  }

  private authorize(
    tenantId: string,
    siteId: string,
    authorizationHeader: unknown,
    dashboardTokenHeader: unknown,
  ) {
    return this.auth.authorize({
      authorizationHeader,
      dashboardTokenHeader,
      targetTenantId: tenantId,
      targetSiteId: siteId,
    });
  }
}
