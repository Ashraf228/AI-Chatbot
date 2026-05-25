import { Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

@Injectable()
export class DatabaseService {
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL missing');
    }

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

  async transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback({
        query: async <R extends QueryResultRow = QueryResultRow>(
          sql: string,
          params?: readonly unknown[],
        ) => {
          if (params) {
            return client.query<R>(sql, [...params]);
          }
          return client.query<R>(sql);
        },
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
