import { Logger, OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway } from '@nestjs/websockets';
import { SESSION_COOKIE } from '@sellnest/shared';
import { createAdapter } from '@socket.io/redis-adapter';
import { parse as parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { RedisService } from '../../common/redis.service';
import { allowedOrigins } from '../../config/env';
import { SessionService } from '../auth/session.service';
import { RealtimeService, sessionRoom, userRoom } from './realtime.service';

/**
 * Server-to-client delivery only. Sending goes through REST so validation, rate limits and
 * persistence have one path. A socket only ever joins its own user room, so a client has no
 * way to subscribe to someone else's conversations.
 */
@WebSocketGateway({
  path: '/socket.io',
  cors: { origin: () => allowedOrigins(), credentials: true },
  maxHttpBufferSize: 1024,
  allowRequest: (req: { headers: { origin?: string } }, callback: (err: string | null, ok: boolean) => void) => {
    const origin = req.headers.origin;
    callback(null, Boolean(origin && allowedOrigins().includes(origin)));
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private pub?: ReturnType<RedisService['duplicate']>;
  private sub?: ReturnType<RedisService['duplicate']>;

  constructor(
    private readonly sessions: SessionService,
    private readonly realtime: RealtimeService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server) {
    this.pub = this.redis.duplicate();
    this.sub = this.redis.duplicate();
    // Fans out emits across API replicas if more than one is ever run.
    server.adapter(createAdapter(this.pub, this.sub));
    this.realtime.attach(server);
  }

  async handleConnection(socket: Socket) {
    try {
      const token = parseCookie(socket.handshake.headers.cookie ?? '')[SESSION_COOKIE];
      const session = token ? await this.sessions.resolve(token) : null;
      if (!session || session.user.status !== 'ACTIVE') {
        socket.disconnect(true);
        return;
      }
      await socket.join([userRoom(session.userId), sessionRoom(session.id)]);
    } catch (e) {
      this.logger.warn(`Socket auth failed: ${(e as Error).message}`);
      socket.disconnect(true);
    }
  }

  onModuleDestroy() {
    this.pub?.disconnect();
    this.sub?.disconnect();
  }
}
