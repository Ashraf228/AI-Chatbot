import { Module } from '@nestjs/common';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
import { PrismaService } from '../db/prisma.service';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [SitesController],
  providers: [SitesService, PrismaService],
  exports: [SitesService],
})
export class SitesModule {}
