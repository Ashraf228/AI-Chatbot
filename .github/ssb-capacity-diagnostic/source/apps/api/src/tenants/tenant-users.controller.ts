import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { RequireDashboardRoles } from '../utils/dashboard-rbac';
import {
  AuthenticateTenantUserDto,
  CreateTenantUserDto,
  SetCustomerWorkspaceAccessDto,
  UpdateTenantUserDto,
} from './tenant-users.dto';
import { TenantUsersService } from './tenant-users.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/tenant-users')
export class TenantUsersController {
  constructor(private readonly tenantUsers: TenantUsersService) {}

  @Get()
  @RequireDashboardRoles('admin')
  async list(@Query('tenantId') tenantId: string) {
    return this.tenantUsers.listForTenant(tenantId);
  }

  @Post()
  @RequireDashboardRoles('admin')
  async create(@Body() dto: CreateTenantUserDto) {
    return this.tenantUsers.create(dto);
  }

  @Post('authenticate')
  async authenticate(@Body() dto: AuthenticateTenantUserDto) {
    return this.tenantUsers.authenticate(dto);
  }

  @Patch(':id')
  @RequireDashboardRoles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantUserDto) {
    return this.tenantUsers.update(id, dto);
  }

  @Put(':id/customer-workspace-access')
  @RequireDashboardRoles('admin')
  async setCustomerWorkspaceAccess(
    @Param('id') id: string,
    @Body() dto: SetCustomerWorkspaceAccessDto,
  ) {
    return this.tenantUsers.setCustomerWorkspaceAccess(id, dto.siteIds);
  }

  @Delete(':id/customer-workspace-access')
  @RequireDashboardRoles('admin')
  async revokeCustomerWorkspaceAccess(@Param('id') id: string) {
    return this.tenantUsers.revokeCustomerWorkspaceAccess(id);
  }
}
