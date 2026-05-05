import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminKeyGuard } from '../utils/admin.guard';
import { CreateTenantDto } from './dto';
import { TenantsService } from './tenants.service';

@UseGuards(AdminKeyGuard)
@Controller('admin/tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  async list() {
    return this.tenants.listTenants();
  }

  @Post()
  async create(@Body() dto: CreateTenantDto) {
    return this.tenants.createTenant(dto);
  }
}
