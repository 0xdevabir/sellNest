import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth.decorators';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up. Must not touch dependencies, or a DB blip restarts the API. */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies answer. Reports only up or down, never connection details. */
  @Get('ready')
  async ready() {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up', () => 'down'),
      this.redis.client.ping().then(() => 'up', () => 'down'),
    ]);
    if (database !== 'up' || redis !== 'up') {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: `database ${database}, redis ${redis}` });
    }
    return { status: 'ok', database, redis };
  }
}
