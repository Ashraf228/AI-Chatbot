import { DatabaseMigrationsService } from './database-migrations.service';
import { PrismaService } from './prisma.service';
import { assertMaintenanceBootstrap, runtimeState, withMaintenanceOwner } from '../maintenance/maintenance-runtime';
import { privateFile } from '../admin-writer/private-file';
import { assertDatabaseIdentity, assertDatabaseUrl } from '../admin-writer/database-identity';

async function run() {
  assertMaintenanceBootstrap();
  if (process.env.DATABASE_URL || process.env.ADMIN_WRITER_DATABASE_URL_FILE || process.env.OPENAI_API_KEY) throw new Error('Migrator inherited application credentials');
  const binding = JSON.parse(privateFile(process.env.MAINTENANCE_OPERATOR_FILE));
  const state = runtimeState();
  if (!state || binding.service !== state.binding.service || binding.generation !== state.binding.generation) throw new Error('Migrator binding invalid');
  state.assertEpoch(binding.owner, binding.epoch);
  state.drained(binding.owner, binding.epoch);
  process.env.DATABASE_URL = assertDatabaseUrl(privateFile(process.env.MIGRATOR_DATABASE_URL_FILE), 'ssb_migrator');
  const db = new PrismaService();
  delete process.env.DATABASE_URL;
  try {
    await withMaintenanceOwner(binding.owner, async () => {
      await assertDatabaseIdentity(db, 'ssb_migrator');
      await new DatabaseMigrationsService(db).runPendingMigrations();
    }, binding.epoch);
  } finally { await db.close(); }
}

run().catch((error) => {
  console.error('Migration run failed');
  process.exit(1);
});
