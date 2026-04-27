import { Injectable } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class PrismaService {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL missing');
    this.pool = new Pool({ connectionString });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }> {
    if (params) {
      return this.pool.query<T>(sql, [...params]);
    }

    return this.pool.query<T>(sql);
  }
}
