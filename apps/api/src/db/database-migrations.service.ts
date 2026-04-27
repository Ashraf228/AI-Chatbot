import { Injectable, OnModuleInit } from '@nestjs/common';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from './prisma.service';

type MigrationRow = {
  version: string;
};

function getMigrationsDir() {
  return join(process.cwd(), 'migrations');
}

@Injectable()
export class DatabaseMigrationsService implements OnModuleInit {
  constructor(private readonly db: PrismaService) {}

  async onModuleInit() {
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
