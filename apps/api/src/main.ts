import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression = require('compression');
import type { Request } from 'express';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

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
  const app = await NestFactory.create(AppModule, { cors: false });
  const allowedOrigins = parseAllowedOrigins();

  app.use(helmet());
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors((req: Request, callback: (error: Error | null, options: CorsOptions) => void) => {
    callback(null, buildCorsOptions(req, allowedOrigins));
  });

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 5000);
}
bootstrap();
