import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

/** Runs background jobs without serving HTTP, so email and cleanup cannot slow API responses. */
async function bootstrap() {
  process.env.SELLNEST_ROLE = 'worker';
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
