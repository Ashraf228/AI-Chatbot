import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { AuthenticateTenantUserDto, CreateTenantUserDto, UpdateTenantUserDto } from './tenant-users.dto';
import { TenantUsersService } from './tenant-users.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/tenant-users')
export class TenantUsersController {
  constructor(private readonly tenantUsers: TenantUsersService) {}

  @Get()
  async list(@Query('tenantId') tenantId: string) {
    return this.tenantUsers.listForTenant(tenantId);
  }

  @Post()
  async create(@Body() dto: CreateTenantUserDto) {
    return this.tenantUsers.create(dto);
  }

  @Post('authenticate')
  async authenticate(@Body() dto: AuthenticateTenantUserDto) {
    return this.tenantUsers.authenticate(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantUserDto) {
    return this.tenantUsers.update(id, dto);
  }
}
