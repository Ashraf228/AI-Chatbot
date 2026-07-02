import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from './prisma.service';

type MigrationRow = {
  version: string;
};

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
    await this.ensureMigrationsTable();
    await this.applyPendingMigrations();
  }

  private async ensureMigrationsTable() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  private async applyPendingMigrations() {
    const dir = getMigrationsDir();
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const existing = await this.db.query<MigrationRow>(
      `SELECT version
       FROM schema_migrations`,
    );

    const applied = new Set(existing.rows.map((row) => row.version));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(join(dir, file), 'utf8');

      await this.db.query('BEGIN');

      try {
        await this.db.query(sql);
        await this.db.query(
          `INSERT INTO schema_migrations(version)
           VALUES ($1)`,
          [file],
        );
        await this.db.query('COMMIT');
      } catch (error) {
        await this.db.query('ROLLBACK');
        throw error;
      }
    }
  }
}
