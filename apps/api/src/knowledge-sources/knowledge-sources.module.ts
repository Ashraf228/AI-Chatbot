import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesModule } from '../sites/sites.module';
import { ProviderApprovalStorageLookupService } from './provider-approval-storage-lookup.service';
import { KnowledgeSourcesService } from './knowledge-sources.service';

@Module({
  imports: [SitesModule],
  providers: [KnowledgeSourcesService, ProviderApprovalStorageLookupService, PrismaService],
  exports: [KnowledgeSourcesService, ProviderApprovalStorageLookupService],
})
export class KnowledgeSourcesModule {}
