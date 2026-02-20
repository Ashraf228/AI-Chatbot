import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SitesService {
  constructor(private db: PrismaService) {}

  async createSite(id: string, name: string, allowedDomains: string[], config: any = {}) {
    await this.db.query(
      `INSERT INTO sites(id, name, allowed_domains, config)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, allowed_domains=EXCLUDED.allowed_domains, config=EXCLUDED.config`,
      [id, name, allowedDomains, config],
    );
    return this.getSite(id);
  }

  async getSite(id: string) {
    const res = await this.db.query(`SELECT * FROM sites WHERE id=$1`, [id]);
    return res.rows[0] || null;
  }

  async listSites() {
    const res = await this.db.query(`SELECT * FROM sites ORDER BY created_at DESC`);
    return res.rows;
  }
}