import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { allowedOrigins, env } from './config/env';

/** Shared by main.ts and the integration tests, so tests exercise the same HTTP behaviour. */
export function configureApp(app: NestExpressApplication) {
  // One proxy hop (nginx or the Next rewrite), so req.ip is the client and not a spoofed header.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: env().NODE_ENV === 'production' ? undefined : false }));
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '256kb' });
  app.enableCors({ origin: allowedOrigins(), credentials: true });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
}
