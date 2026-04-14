import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression = require('compression');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.use(helmet());
  app.use(compression());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Basic CORS is enabled; domain allowlisting happens in chat endpoint.
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 5000);
}
bootstrap();
