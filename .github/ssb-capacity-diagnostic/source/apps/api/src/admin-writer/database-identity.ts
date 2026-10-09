import { Pool } from 'pg';
import type { Queryable } from '../db/database.service';
import { assertRuntimeGrantBinding } from './runtime-contract';

export function assertDatabaseUrl(value: string | undefined, expected: 'ssb_runtime' | 'ssb_admin_writer' | 'ssb_migrator'): string {
  let url: URL;
  try { url = new URL(value || ''); } catch { throw new Error('Explicit database binding required'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username !== expected || !url.password
    || !url.hostname || !/^\/[A-Za-z0-9_-]+$/.test(url.pathname) || url.search || url.hash
    || Object.keys(process.env).some(key => key.startsWith('PG') && process.env[key])) {
    throw new Error('Database connection binding invalid');
  }
  return value!;
}

export async function assertDatabaseIdentity(db: Queryable, expected: 'ssb_runtime' | 'ssb_admin_writer' | 'ssb_migrator') {
  const role = (await db.query(`SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication
    FROM pg_roles WHERE rolname=current_user`)).rows[0];
  if (!role || role.name !== expected || Object.entries(role).some(([key,value]) => key !== 'name' && value !== false)) throw new Error('Database identity invalid');
  if ((await db.query('SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows.length) throw new Error('Database role membership forbidden');
  const ledger = (await db.query(`SELECT c.relkind, pg_get_userbyid(c.relowner) AS owner,
    has_table_privilege(c.oid,'SELECT') AS can_read, has_table_privilege(c.oid,'INSERT') AS can_insert,
    has_table_privilege(c.oid,'UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES') AS can_mutate
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='maintenance_admin' AND c.relname='writer_receipts'`)).rows;
  if (ledger.length !== 1 || ledger[0].relkind !== 'r' || ledger[0].owner !== 'ssb_migrator') throw new Error('Receipt ledger binding missing');
  const key = (await db.query(`SELECT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_index i ON i.indexrelid=c.conindid
    WHERE c.conrelid=(SELECT r.oid FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace
      WHERE n.nspname='maintenance_admin' AND r.relname='writer_receipts') AND c.contype='p'
      AND NOT c.condeferrable AND NOT c.condeferred AND c.convalidated
      AND i.indisvalid AND i.indisready AND i.indislive AND i.indisunique
      AND i.indpred IS NULL AND i.indexprs IS NULL
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id' AND atttypid='uuid'::regtype AND attnotnull)]::smallint[]
    ) AS valid`)).rows[0];
  if (key?.valid !== true) throw new Error('Receipt replay key invalid');
  if (expected !== 'ssb_migrator' && (ledger[0].can_mutate !== false
    || ledger[0].can_read !== (expected === 'ssb_admin_writer') || ledger[0].can_insert !== (expected === 'ssb_admin_writer'))) {
    throw new Error('Receipt ledger privileges invalid');
  }
  if (expected === 'ssb_migrator') return;
  if ((await db.query("SELECT has_schema_privilege('public','CREATE') AS allowed")).rows[0].allowed) throw new Error('Application schema creation forbidden');
  if ((await db.query(`SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)
    UNION ALL SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)`)).rows.length) throw new Error('Application ownership forbidden');
  if ((await db.query(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','maintenance_admin') AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE')`)).rows.length) throw new Error('Privileged application function forbidden');
  if (expected === 'ssb_runtime') {
    for (const table of ['tenants','tenant_users','tenant_subscriptions','plans','provider_approval_grants','provider_approval_audit_events']) {
      if ((await db.query(`SELECT has_table_privilege($1,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS allowed`, [table])).rows[0].allowed) throw new Error('Runtime authority privilege forbidden');
      if ((await db.query(`SELECT 1 FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped
        AND has_column_privilege($1,attname,'INSERT,UPDATE')`, [table])).rows.length) throw new Error('Runtime authority column privilege forbidden');
    }
    for (const [table, columns] of [['sites',['id','tenant_id']],['knowledge_sources',['id','tenant_id','site_id']]] as const) {
      if ((await db.query(`SELECT has_table_privilege($1,'DELETE,TRUNCATE,TRIGGER') AS allowed`, [table])).rows[0].allowed) throw new Error('Runtime parent privilege forbidden');
      for (const column of columns) if ((await db.query(`SELECT has_column_privilege($1,$2,'UPDATE') AS allowed`, [table,column])).rows[0].allowed) throw new Error('Runtime identity update forbidden');
    }
  }
}

export async function assertRuntimeDatabase() {
  if (process.env.NODE_ENV !== 'production') return;
  assertRuntimeGrantBinding();
  if (process.env.ADMIN_WRITER_DATABASE_URL_FILE || process.env.ADMIN_WRITER_SIGNING_KEY_FILE || process.env.MIGRATOR_DATABASE_URL_FILE
    || process.env.RUN_MIGRATIONS_ON_STARTUP === 'true') throw new Error('Runtime administrative credentials/startup forbidden');
  const connectionString = assertDatabaseUrl(process.env.DATABASE_URL, 'ssb_runtime');
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  try { await assertDatabaseIdentity(pool, 'ssb_runtime'); } finally { await pool.end(); }
}
