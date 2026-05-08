import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AdminScopeService } from './admin-scope.service';

@Global()
@Module({
  providers: [AdminScopeService, PrismaService],
  exports: [AdminScopeService],
})
export class AdminScopeModule {}
