import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './db/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @Get('healthz')
  async healthz() {
    await this.db.query('SELECT 1');

    return {
      ok: true,
      service: 'api',
    };
  }
}
