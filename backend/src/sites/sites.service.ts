import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class SitesService {
  constructor(private db: PrismaService) {}

  async createSite(
    id: string,
    tenantId: string,
    name: string,
    allowedDomains: string[],
    config: any = {},
  ) {
    const publicKey = 'pk_' + randomBytes(32).toString('hex');

    await this.db.query(
      `INSERT INTO sites(id, tenant_id, name, allowed_domains, public_key, config)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id=EXCLUDED.tenant_id,
         name=EXCLUDED.name,
         allowed_domains=EXCLUDED.allowed_domains,
         config=EXCLUDED.config`,
      [id, tenantId, name, allowedDomains, publicKey, config],
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