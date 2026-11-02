import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_MAX_LISTING_IMAGES,
  DEFAULT_RADII_KM,
  PlatformSettings,
  platformSettingsSchema,
} from '@sellnest/shared';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

const KEY = 'platform';
const CACHE_KEY = 'settings:platform';

export const DEFAULT_SETTINGS: PlatformSettings = {
  maxListingImages: DEFAULT_MAX_LISTING_IMAGES,
  dailyPublishLimit: 10,
  newAccountReviewDays: 7,
  prohibitedKeywords: [],
  radiiKm: [...DEFAULT_RADII_KM],
  defaultRadiusKm: 5,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  get(): Promise<PlatformSettings> {
    return this.redis.cached(CACHE_KEY, 60, async () => {
      const row = await this.prisma.platformSetting.findUnique({ where: { key: KEY } });
      const parsed = platformSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(row?.value as object | null) });
      return parsed.success ? parsed.data : DEFAULT_SETTINGS;
    });
  }

  async update(value: PlatformSettings, tx: Prisma.TransactionClient = this.prisma) {
    await tx.platformSetting.upsert({
      where: { key: KEY },
      create: { key: KEY, value },
      update: { value },
    });
  }

  invalidate() {
    return this.redis.invalidate(CACHE_KEY);
  }
}
