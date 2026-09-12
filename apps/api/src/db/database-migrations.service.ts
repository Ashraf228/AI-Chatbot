import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdir, readFile } from 'fs/promises';
import { performance } from 'perf_hooks';
import { join } from 'path';

import { DatabaseSession, Queryable } from './database.service';
import { PrismaService } from './prisma.service';

type MigrationRow = {
  version: string;
};

type AdvisoryLockRow = {
  acquired: unknown;
};

type AdvisoryUnlockRow = {
  released: unknown;
};

type MigrationLockTiming = {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
};

const MIGRATION_LOCK_NAMESPACE = 1397965313;
const MIGRATION_LOCK_VERSION = 1;
const MIGRATION_LOCK_POLL_INTERVAL_MS = 250;
const MIGRATION_LOCK_TIMEOUT_MS = 120_000;

function createMigrationLockTiming(): MigrationLockTiming {
  return {
    now: () => performance.now(),
    sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  };
}

type MigrationStartupEnv = {
  nodeEnv?: string;
  runMigrationsOnStartup?: string;
  allowProductionAutoMigrations?: string;
};

export type MigrationStartupDecision = {
  allowed: boolean;
  reason: string;
};

function getMigrationsDir() {
  return join(process.cwd(), 'migrations');
}

export function shouldRunMigrationsOnStartup(env: MigrationStartupEnv): MigrationStartupDecision {
  const nodeEnv = env.nodeEnv || 'development';
  const runMigrationsOnStartup = env.runMigrationsOnStartup;
  const allowProductionAutoMigrations = env.allowProductionAutoMigrations;

  if (nodeEnv === 'production') {
    if (runMigrationsOnStartup === 'true' && allowProductionAutoMigrations === 'true') {
      return { allowed: true, reason: 'production-explicitly-enabled' };
    }

    return { allowed: false, reason: 'production-auto-migrations-disabled' };
  }

  if (runMigrationsOnStartup === 'false') {
    return { allowed: false, reason: 'startup-migrations-disabled' };
  }

  return { allowed: true, reason: 'non-production-default' };
}

@Injectable()
export class DatabaseMigrationsService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseMigrationsService.name);
  // Tests replace only this internal clock; production has no lock timing configuration.
  private migrationLockTiming = createMigrationLockTiming();

  constructor(private readonly db: PrismaService) {}

  async onModuleInit() {
    const decision = shouldRunMigrationsOnStartup({
      nodeEnv: process.env.NODE_ENV,
      runMigrationsOnStartup: process.env.RUN_MIGRATIONS_ON_STARTUP,
      allowProductionAutoMigrations: process.env.ALLOW_PRODUCTION_AUTO_MIGRATIONS,
    });

    if (!decision.allowed) {
      this.logger.log('Database auto-migrations skipped', {
        nodeEnv: process.env.NODE_ENV || 'development',
        runMigrationsOnStartup: process.env.RUN_MIGRATIONS_ON_STARTUP || 'unset',
        allowProductionAutoMigrations: process.env.ALLOW_PRODUCTION_AUTO_MIGRATIONS || 'unset',
        reason: decision.reason,
      });
      return;
    }

    this.logger.log('Database auto-migrations enabled', {
      nodeEnv: process.env.NODE_ENV || 'development',
      reason: decision.reason,
    });

    await this.runPendingMigrations();
  }

  async runPendingMigrations() {
    await this.db.withReservedSession(async (session) => {
      let lockAcquired = false;
      let primaryError: unknown;

      try {
        lockAcquired = await this.acquireMigrationLock(session);
        await this.ensureMigrationsTable(session);
        await this.applyPendingMigrations(session);
      } catch (error) {
        primaryError = error;
        throw error;
      } finally {
        if (lockAcquired) {
          await this.releaseMigrationLock(session, primaryError);
        }
      }
    });
  }

  private async ensureMigrationsTable(session: Queryable) {
    await session.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  private async applyPendingMigrations(session: DatabaseSession) {
    const dir = getMigrationsDir();
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const existing = await session.query<MigrationRow>(
      `SELECT version
       FROM schema_migrations`,
    );

    const applied = new Set(existing.rows.map((row) => row.version));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(join(dir, file), 'utf8');

      this.logger.log('Database migration transaction started', {
        migration: file,
        phase: 'start',
      });

      try {
        await session.transaction(async (tx) => {
          await tx.query(sql);
          await tx.query(
            `INSERT INTO schema_migrations(version)
             VALUES ($1)`,
            [file],
          );
        });
      } catch (error) {
        this.logger.error('Database migration transaction failed', {
          migration: file,
          phase: 'rolled_back',
        });
        throw error;
      }

      this.logger.log('Database migration transaction committed', {
        migration: file,
        phase: 'committed',
      });
    }
  }

  private async acquireMigrationLock(session: DatabaseSession): Promise<boolean> {
    const startedAt = this.migrationLockTiming.now();
    this.logger.log('migration_lock_wait_started', { phase: 'acquire' });

    while (true) {
      let result: { rows: AdvisoryLockRow[] };
      try {
        result = await session.query<AdvisoryLockRow>(
          `SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired`,
          [MIGRATION_LOCK_NAMESPACE, MIGRATION_LOCK_VERSION],
        );
      } catch (error) {
        session.markUnusable(error);
        throw error;
      }
      const acquired = result.rows[0]?.acquired;

      if (acquired === true) {
        this.logger.log('migration_lock_acquired', {
          phase: 'acquire',
          waitMilliseconds: Math.max(0, this.migrationLockTiming.now() - startedAt),
        });
        return true;
      }

      if (acquired !== false) {
        const error = new Error('Migration advisory lock returned an unexpected result');
        session.markUnusable(error);
        throw error;
      }

      const elapsed = this.migrationLockTiming.now() - startedAt;
      if (elapsed >= MIGRATION_LOCK_TIMEOUT_MS) {
        this.logger.error('migration_lock_timeout', {
          phase: 'acquire',
          waitMilliseconds: Math.max(0, elapsed),
        });
        throw new Error('Migration advisory lock acquisition timed out');
      }

      await this.migrationLockTiming.sleep(MIGRATION_LOCK_POLL_INTERVAL_MS);
    }
  }

  private async releaseMigrationLock(session: DatabaseSession, primaryError: unknown) {
    try {
      const result = await session.query<AdvisoryUnlockRow>(
        `SELECT pg_advisory_unlock($1::integer, $2::integer) AS released`,
        [MIGRATION_LOCK_NAMESPACE, MIGRATION_LOCK_VERSION],
      );
      if (result.rows[0]?.released !== true) {
        throw new Error('Migration advisory lock release was not confirmed');
      }
      this.logger.log('migration_lock_released', { phase: 'release' });
    } catch (error) {
      session.markUnusable(error);
      this.logger.error('migration_lock_release_failed', { phase: 'release' });
      if (primaryError === undefined) {
        throw error;
      }
    }
  }
}
