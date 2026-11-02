import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { ZodValidationPipe } from 'nestjs-zod';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module';
import { OriginGuard, RateLimitGuard, RolesGuard, SessionGuard } from './common/guards';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { env } from './config/env';
import { AdminController } from './modules/admin/admin.controller';
import { AdminService } from './modules/admin/admin.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { SessionService } from './modules/auth/session.service';
import { CatalogController, CatalogService } from './modules/catalog/catalog';
import { HealthController } from './modules/health/health.controller';
import { MailService } from './modules/jobs/mail.service';
import { WorkerService } from './modules/jobs/worker.service';
import { ListingMapper } from './modules/listings/listing.mapper';
import { ListingsController } from './modules/listings/listings.controller';
import { ListingsService } from './modules/listings/listings.service';
import { SearchService } from './modules/listings/search.service';
import { ConversationsController } from './modules/messaging/conversations.controller';
import { ConversationsService } from './modules/messaging/conversations.service';
import { NotificationsController } from './modules/notifications/notifications.controller';
import { NotificationsService } from './modules/notifications/notifications.service';
import { OffersController } from './modules/offers/offers.controller';
import { OffersService } from './modules/offers/offers.service';
import { RealtimeGateway } from './modules/realtime/realtime.gateway';
import { RealtimeService } from './modules/realtime/realtime.service';
import { TrustController, TrustService } from './modules/trust/trust';
import { UploadsController, UploadsService } from './modules/uploads/uploads';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';

@Module({
  imports: [
    CommonModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: env().NODE_ENV === 'test' ? 'silent' : 'info',
        genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
        // Nothing that authenticates a user may reach the logs.
        redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        // Query strings can hold search text; tokens travel in bodies, which are not logged.
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            path: req.url.split('?')[0],
          }),
        },
        autoLogging: { ignore: (req) => Boolean(req.url?.includes('/health/')) },
      },
    }),
  ],
  controllers: [
    AuthController,
    UsersController,
    ListingsController,
    UploadsController,
    CatalogController,
    ConversationsController,
    OffersController,
    NotificationsController,
    TrustController,
    AdminController,
    HealthController,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: CSRF, then identity, then permissions, then rate limits per identity.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    SessionService,
    AuthService,
    MailService,
    WorkerService,
    RealtimeService,
    RealtimeGateway,
    NotificationsService,
    ListingMapper,
    ListingsService,
    SearchService,
    UploadsService,
    CatalogService,
    UsersService,
    ConversationsService,
    OffersService,
    TrustService,
    AdminService,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly worker: WorkerService) {}

  async onApplicationBootstrap() {
    if (process.env.SELLNEST_ROLE === 'worker' || (env().RUN_WORKER_IN_API && env().NODE_ENV !== 'test')) {
      await this.worker.start();
    }
  }
}
