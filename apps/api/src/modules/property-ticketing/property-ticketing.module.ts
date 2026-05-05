import { Module } from '@nestjs/common';
import { SiteModulesModule } from '../../site-modules/site-modules.module';
import { PropertyTicketingService } from './property-ticketing.service';

@Module({
  imports: [SiteModulesModule],
  providers: [PropertyTicketingService],
  exports: [PropertyTicketingService],
})
export class PropertyTicketingModule {}
