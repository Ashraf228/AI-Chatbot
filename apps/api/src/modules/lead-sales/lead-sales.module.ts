import { Module } from '@nestjs/common';
import { SiteModulesModule } from '../../site-modules/site-modules.module';
import { LeadSalesService } from './lead-sales.service';

@Module({
  imports: [SiteModulesModule],
  providers: [LeadSalesService],
  exports: [LeadSalesService],
})
export class LeadSalesModule {}
