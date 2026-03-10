import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class RetentionService {
  constructor(private db: PrismaService) {}

  // täglich 03:30 Uhr
  @Cron('30 3 * * *')
  async cleanup() {
    await this.db.query(
      `DELETE FROM conversations
       WHERE last_active_at < (now() - interval '30 days')`,
    );
    // messages werden per ON DELETE CASCADE gelöscht
  }
}