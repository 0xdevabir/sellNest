import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });

  constructor() {
    this.client.on('error', (e) => this.logger.warn(`Redis error: ${e.message}`));
  }

  /** New connection for consumers that need their own, such as pub/sub. */
  duplicate() {
    return this.client.duplicate();
  }

  /** Read-through cache. Redis being down degrades to a direct load instead of failing. */
  async cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.client.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      return load();
    }
    const value = await load();
    this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => undefined);
    return value;
  }

  async invalidate(...keys: string[]) {
    await this.client.del(...keys).catch(() => undefined);
  }

  /** Fixed-window counter. Returns whether this hit is within the limit. */
  async hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> {
    const fullKey = `rl:${key}`;
    const results = await this.client.multi().incr(fullKey).expire(fullKey, windowSeconds, 'NX').ttl(fullKey).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? windowSeconds);
    return { allowed: count <= limit, retryAfter: ttl > 0 ? ttl : windowSeconds };
  }

  async onModuleDestroy() {
    this.client.disconnect();
  }
}
