import 'reflect-metadata';
import { Pool } from 'pg';
import { AdminWriter, writerTransaction } from './admin-writer';
import { privateFile } from './private-file';
import { assertDatabaseIdentity, assertDatabaseUrl } from './database-identity';
import { runtimeState, withMaintenanceOwner, maintenanceWork } from '../maintenance/maintenance-runtime';
import { SubscriptionService } from '../billing/subscription.service';

// Host/operator entry only. No HTTP operation can supply an owner, pool or SQL.
export async function operatorWrite(mode: 'write' | 'prepare-defaults', requestFile?: string, signatureFile?: string) {
  if (process.env.DATABASE_URL || process.env.ADMIN_KEY || process.env.OPENAI_API_KEY) throw new Error('Operator inherited runtime credentials');
  const binding = JSON.parse(privateFile(process.env.MAINTENANCE_OPERATOR_FILE));
  const state = runtimeState();
  if (!state || binding.service !== state.binding.service || binding.generation !== state.binding.generation) throw new Error('Operator binding invalid');
  state.assertEpoch(binding.owner, binding.epoch);
  state.drained(binding.owner, binding.epoch);
  const connectionString = assertDatabaseUrl(privateFile(process.env.ADMIN_WRITER_DATABASE_URL_FILE), 'ssb_admin_writer');
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  try {
    await assertDatabaseIdentity(pool, 'ssb_admin_writer');
    return await withMaintenanceOwner(binding.owner, async () => {
      if (mode === 'write') return new AdminWriter(pool, privateFile(process.env.ADMIN_WRITER_SIGNING_KEY_FILE))
        .execute(privateFile(requestFile), privateFile(signatureFile));
      if (mode !== 'prepare-defaults') throw new Error('Unsupported operator action');
      const outcome = await maintenanceWork('configuration', async () => {
        const snapshot = state.snapshot();
        if (snapshot.pilot && !snapshot.terminal) throw new Error('Pilot cleanup required');
        return writerTransaction(pool, async db => {
          const subscriptions = new SubscriptionService(db);
          const tenants = await db.query('SELECT id FROM tenants');
          for (const tenant of tenants.rows) await subscriptions.getCurrentSubscription(tenant.id);
          return { tenantsPrepared: tenants.rows.length };
        });
      }, true);
      if ('error' in outcome) throw outcome.error;
      return outcome.result;
    }, binding.epoch);
  } finally { await pool.end(); }
}

if (require.main === module) void operatorWrite(process.argv[2] as 'write' | 'prepare-defaults',process.argv[3],process.argv[4])
  .then(() => console.log('operator_write_complete')).catch(() => { console.error('operator_write_failed'); process.exitCode=1; });
