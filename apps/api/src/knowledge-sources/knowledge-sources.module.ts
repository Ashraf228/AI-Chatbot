import { Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { SitesModule } from '../sites/sites.module';
import { KnowledgeSourcesService } from './knowledge-sources.service';

@Module({
  imports: [SitesModule],
  providers: [KnowledgeSourcesService, PrismaService],
  exports: [KnowledgeSourcesService],
})
export class KnowledgeSourcesModule {}
