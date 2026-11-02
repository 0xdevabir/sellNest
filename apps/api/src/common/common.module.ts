import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, AuditService, SettingsService, StorageService],
  exports: [PrismaService, RedisService, AuditService, SettingsService, StorageService],
})
export class CommonModule {}
