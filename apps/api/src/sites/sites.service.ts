import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { randomBytes } from 'crypto';
import { SiteConfigInput } from './dto';

type SiteRow = {
  id: string;
  tenant_id: string | null;
  name: string;
  allowed_domains: string[];
  public_key: string | null;
  config: Record<string, unknown>;
  created_at?: string;
};

@Injectable()
export class SitesService {
  constructor(private db: PrismaService) {}

  async createSite(
    id: string,
    tenantId: string,
    name: string,
    allowedDomains: string[],
    config: SiteConfigInput = {},
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

  async getSite(id: string): Promise<SiteRow | null> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites WHERE id=$1`, [id]);
    return res.rows[0] || null;
  }

  async listSites(): Promise<SiteRow[]> {
    const res = await this.db.query<SiteRow>(`SELECT * FROM sites ORDER BY created_at DESC`);
    return res.rows;
  }
}
