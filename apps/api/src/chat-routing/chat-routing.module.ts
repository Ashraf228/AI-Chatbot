import { Module } from '@nestjs/common';
import { SiteModulesModule } from '../site-modules/site-modules.module';
import { ChatRoutingService } from './chat-routing.service';

@Module({
  imports: [SiteModulesModule],
  providers: [ChatRoutingService],
  exports: [ChatRoutingService],
})
export class ChatRoutingModule {}
