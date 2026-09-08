import { Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

import { logEvent } from '../utils/logger';

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
    let discardClientError: Error | undefined;
    let transactionError: unknown;

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
      transactionError = error;
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        discardClientError = rollbackError instanceof Error
          ? rollbackError
          : new Error('Database transaction rollback failed');
        const errorCode = (rollbackError as { code?: unknown })?.code;
        logEvent('database_transaction_rollback_failed', {
          phase: 'rollback',
          errorName: discardClientError.name,
          errorCode: typeof errorCode === 'string' ? errorCode : null,
          clientDiscarded: true,
        });
      }
      throw error;
    } finally {
      try {
        client.release(discardClientError);
      } catch (releaseError) {
        const safeReleaseError = releaseError instanceof Error
          ? releaseError
          : new Error('Database transaction client release failed');
        logEvent('database_transaction_client_release_failed', {
          phase: 'release',
          errorName: safeReleaseError.name,
          errorCode: typeof (releaseError as { code?: unknown })?.code === 'string'
            ? (releaseError as { code: string }).code
            : null,
          clientDiscarded: discardClientError !== undefined,
        });

        if (transactionError === undefined) {
          throw releaseError;
        }
      }
    }
  }
}
