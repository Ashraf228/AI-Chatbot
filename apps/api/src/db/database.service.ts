import { Injectable } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';

import { logEvent } from '../utils/logger';

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
};

export type DatabaseSession = Queryable & {
  transaction<T>(callback: (client: Queryable) => Promise<T>): Promise<T>;
  markUnusable(error: unknown): void;
};

type ClientState = {
  discardError?: Error;
  lifecycle: 'active' | 'draining' | 'released';
  operations: Set<Promise<unknown>>;
  operationFailed: boolean;
  operationFailure?: unknown;
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
    this.pool.on('error', (error) => {
      const errorCode = (error as unknown as { code?: unknown }).code;
      logEvent('database_pool_client_error', {
        errorName: error.name,
        errorCode: typeof errorCode === 'string' ? errorCode : null,
      });
    });
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
    return this.withReservedSession((session) => session.transaction(callback));
  }

  /**
   * Reserves one pool client for callers that need several transactions to share
   * the same PostgreSQL session. The caller never receives release access.
   */
  async withReservedSession<T>(callback: (session: DatabaseSession) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    const state: ClientState = {
      lifecycle: 'active',
      operations: new Set(),
      operationFailed: false,
    };
    const eventClient = client as unknown as {
      on?: (event: 'error', listener: (error: Error) => void) => void;
      removeListener?: (event: 'error', listener: (error: Error) => void) => void;
    };
    const onClientError = (error: Error) => {
      state.discardError ??= error;
      const errorCode = (error as unknown as { code?: unknown }).code;
      logEvent('database_session_client_error', {
        errorName: error.name,
        errorCode: typeof errorCode === 'string' ? errorCode : null,
        clientDiscarded: true,
      });
    };
    eventClient.on?.('error', onClientError);

    let result: T | undefined;
    let primaryError: unknown;
    let primaryFailed = false;
    try {
      result = await callback({
        query: (sql, params) => this.startSessionOperation(
          state,
          () => this.queryOnClient(client, state, sql, params),
        ),
        transaction: (transactionCallback) => this.startSessionOperation(
          state,
          () => this.transactionOnClient(client, state, transactionCallback),
        ),
        markUnusable: (error) => {
          this.assertSessionActive(state);
          state.discardError = error instanceof Error
            ? error
            : new Error('Database session client is unavailable');
        },
      });
    } catch (error) {
      primaryError = error;
      primaryFailed = true;
    }

    state.lifecycle = 'draining';
    const drainError = await this.drainOperations(state);
    if (!primaryFailed && drainError.failed) {
      primaryError = drainError.error;
      primaryFailed = true;
    }

    state.lifecycle = 'released';
    eventClient.removeListener?.('error', onClientError);
    try {
      client.release(state.discardError);
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
        clientDiscarded: state.discardError !== undefined,
      });

      if (!primaryFailed) {
        primaryError = releaseError;
        primaryFailed = true;
      }
    }

    if (primaryFailed) {
      throw primaryError;
    }

    return result as T;
  }

  private startSessionOperation<T>(
    state: ClientState,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      this.assertSessionActive(state);
    } catch (error) {
      return Promise.reject(error);
    }

    // Register before scheduling client work so cleanup cannot release an in-flight query.
    const operationPromise = Promise.resolve().then(operation);
    state.operations.add(operationPromise);
    void operationPromise.then(
      () => state.operations.delete(operationPromise),
      (error) => {
        state.operationFailed = true;
        state.operationFailure ??= error;
        state.operations.delete(operationPromise);
      },
    );
    return operationPromise;
  }

  private async drainOperations(state: ClientState): Promise<{ failed: boolean; error: unknown }> {
    const results = await Promise.allSettled([...state.operations]);
    const rejected = results.find((result) => result.status === 'rejected');
    if (state.operationFailed) {
      return { failed: true, error: state.operationFailure };
    }
    return rejected?.status === 'rejected'
      ? { failed: true, error: rejected.reason }
      : { failed: false, error: undefined };
  }

  private async transactionOnClient<T>(
    client: PoolClient,
    state: ClientState,
    callback: (client: Queryable) => Promise<T>,
  ): Promise<T> {
    this.assertClientUsable(state);

    try {
      await client.query('BEGIN');
      const result = await callback({
        query: (sql, params) => this.queryOnClient(client, state, sql, params),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        state.discardError = rollbackError instanceof Error
          ? rollbackError
          : new Error('Database transaction rollback failed');
        const errorCode = (rollbackError as { code?: unknown })?.code;
        logEvent('database_transaction_rollback_failed', {
          phase: 'rollback',
          errorName: state.discardError.name,
          errorCode: typeof errorCode === 'string' ? errorCode : null,
          clientDiscarded: true,
        });
      }
      throw error;
    }
  }

  private async queryOnClient<T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    state: ClientState,
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }> {
    this.assertClientUsable(state);
    if (params) {
      return client.query<T>(sql, [...params]);
    }
    return client.query<T>(sql);
  }

  private assertSessionActive(state: ClientState) {
    this.assertClientUsable(state);
    if (state.lifecycle !== 'active') {
      throw new Error('Database session is not accepting new operations');
    }
  }

  private assertClientUsable(state: ClientState) {
    if (state.lifecycle === 'released') {
      throw new Error('Database session has ended');
    }
    if (state.discardError !== undefined) {
      throw new Error('Database session client is unavailable');
    }
  }
}
