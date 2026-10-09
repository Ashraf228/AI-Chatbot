import 'reflect-metadata';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { Pool } from 'pg';
import { HttpException } from '@nestjs/common';
import { AdminWriter } from './admin-writer';
import { assertMaintenanceBootstrap, localMaintenanceWork, runtimeState } from '../maintenance/maintenance-runtime';
import { installGracefulShutdown } from '../maintenance/graceful-shutdown';
import { assertDatabaseIdentity, assertDatabaseUrl } from './database-identity';
import { privateFile } from './private-file';

export function writerHandler(writer: AdminWriter) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST' || req.url !== '/v1/write') { res.writeHead(404); res.end('{"message":"Not found"}'); return; }
    try {
      await localMaintenanceWork(async () => {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) { size += chunk.length; if (size > 65536) throw new HttpException('Invalid request', 413); chunks.push(Buffer.from(chunk)); }
      const signature = req.headers['x-admin-writer-signature'];
      if (typeof signature !== 'string') throw new HttpException('Unauthorized', 401);
      const result = await writer.execute(Buffer.concat(chunks).toString('utf8'), signature);
      res.writeHead(200); res.end(JSON.stringify(result));
      });
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 503;
      res.writeHead(status);
      const body = error instanceof HttpException && status < 500 ? error.getResponse() : { message: 'Writer unavailable' };
      res.end(JSON.stringify(typeof body === 'string' ? { message: body } : body));
    }
  };
}

export async function startAdminWriter() {
  if (process.env.DATABASE_URL || process.env.OPENAI_API_KEY || process.env.ADMIN_KEY || process.env.REDIS_URL
    || process.env.MIGRATOR_DATABASE_URL_FILE || process.env.MAINTENANCE_OPERATOR_FILE) throw new Error('Writer must not inherit runtime credentials');
  assertMaintenanceBootstrap();
  if (!runtimeState()) throw new Error('Maintenance binding required');
  const connectionString = assertDatabaseUrl(privateFile(process.env.ADMIN_WRITER_DATABASE_URL_FILE), 'ssb_admin_writer');
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 10000 });
  pool.on('error', () => { console.error('admin_writer_idle_connection_failed'); });
  try {
    await assertDatabaseIdentity(pool, 'ssb_admin_writer');
    const writer = new AdminWriter(pool, privateFile(process.env.ADMIN_WRITER_SIGNING_KEY_FILE));
    const server = createServer(writerHandler(writer));
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    let listening: Promise<void>;
    let closed = false;
    installGracefulShutdown('admin-writer', {
      close: async () => {
        await listening;
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await pool.end(); closed = true;
      },
      poolsClosed: () => closed && pool.totalCount === 0,
    });
    listening = new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(Number(process.env.ADMIN_WRITER_PORT || 3011), '0.0.0.0', resolve); });
    await listening;
    return { server, pool };
  } catch (error) { await pool.end(); throw error; }
}

if (require.main === module) void startAdminWriter().catch(() => { console.error('admin_writer_start_failed'); process.exitCode = 1; });
