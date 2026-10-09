import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression = require('compression');
import * as express from 'express';
import type { Request } from 'express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { readSitePilotAccessRules } from './utils/site-pilot-access';
import { assertMaintenanceBootstrap, maintenanceIngress, MaintenanceInterceptor } from './maintenance/maintenance-runtime';
import { runtimeAdminBoundary } from './admin-writer/runtime-boundary';
import { assertRuntimeDatabase } from './admin-writer/database-identity';
import { closeDatabasePools, databasePoolsClosed } from './db/database.service';
import { installGracefulShutdown } from './maintenance/graceful-shutdown';

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin.toLowerCase();
  } catch {
    return '';
  }
}

function parseAllowedOrigins() {
  const origins = new Set<string>();
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const origin of envOrigins) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  const domainEnvVars = [
    process.env.ADMIN_DOMAIN,
    process.env.API_DOMAIN,
    process.env.WIDGET_DOMAIN,
  ].filter(Boolean) as string[];

  for (const host of domainEnvVars) {
    origins.add(`https://${host}`.toLowerCase());
    origins.add(`http://${host}`.toLowerCase());
  }

  const publicUrlEnvVars = [
    process.env.PUBLIC_API_BASE_URL,
    process.env.PUBLIC_WIDGET_BUNDLE_URL,
    process.env.NEXT_PUBLIC_WIDGET_LOADER_URL,
  ].filter(Boolean) as string[];

  for (const value of publicUrlEnvVars) {
    const normalized = normalizeOrigin(value);
    if (normalized) {
      origins.add(normalized);
    }
  }

  origins.add('http://localhost:3000');
  origins.add('http://localhost:5173');
  origins.add('http://admin.localhost');
  origins.add('http://api.localhost');
  origins.add('http://widget.localhost');

  return origins;
}

function buildCorsOptions(req: Request, allowedOrigins: Set<string>): CorsOptions {
  const originHeader = req.header('origin');
  const normalizedOrigin = originHeader ? normalizeOrigin(originHeader) : '';
  const path = req.path ?? req.url ?? '';
  const isWidgetRoute = path.startsWith('/widget/');

  if (!normalizedOrigin) {
    return { origin: false };
  }

  if (isWidgetRoute) {
    const allowWidgetOrigin = normalizedOrigin.startsWith('https://') || normalizedOrigin.startsWith('http://');
    return {
      origin: allowWidgetOrigin ? normalizedOrigin : false,
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Site-Key', 'X-Session-Id'],
      maxAge: 86400,
    };
  }

  return {
    origin: allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : false,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
    maxAge: 86400,
  };
}

async function bootstrap() {
  readSitePilotAccessRules();
  assertMaintenanceBootstrap();
  await assertRuntimeDatabase();
  const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false });
  assertMaintenanceBootstrap();
  app.useGlobalInterceptors(new MaintenanceInterceptor());
  const allowedOrigins = parseAllowedOrigins();

  const mockHandoffRawParser = express.raw({ type: 'application/json', limit: '64kb' });
  app.use((req: Request, res: express.Response, next: express.NextFunction) => {
    const path = req.path || req.url.split('?')[0];
    return path === '/internal/evaluation/mock-handoff/v1'
      ? mockHandoffRawParser(req, res, next)
      : next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(maintenanceIngress);
  app.use(runtimeAdminBoundary);
  app.use(helmet());
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors((req: Request, callback: (error: Error | null, options: CorsOptions) => void) => {
    callback(null, buildCorsOptions(req, allowedOrigins));
  });

  let listening: Promise<unknown>;
  installGracefulShutdown('api', {
    close: async () => { await listening; await app.close(); await closeDatabasePools(); },
    poolsClosed: databasePoolsClosed,
  });
  listening = app.listen(process.env.PORT ? Number(process.env.PORT) : 5000);
  await listening;
}
void bootstrap().catch(() => { console.error('api_start_failed'); process.exit(1); });
