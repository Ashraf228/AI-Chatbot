import { DatabaseService } from '../db/database.service';
import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { TenantUsersController } from './tenant-users.controller';
import { TenantUsersService } from './tenant-users.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController, TenantUsersController],
  providers: [
    TenantsService,
    TenantUsersService,
    PrismaService,
    { provide: DatabaseService, useExisting: PrismaService },
  ],
  exports: [TenantsService, TenantUsersService],
})
export class TenantsModule {}
