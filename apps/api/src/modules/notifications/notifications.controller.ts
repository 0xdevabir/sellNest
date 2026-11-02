import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/auth.decorators';
import { paginated, PaginationDto } from '../../common/dtos';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    const { page, limit } = q as unknown as { page: number; limit: number };
    const { items, total } = await this.notifications.list(user.id, page, limit);
    return paginated(items, total, page, limit);
  }

  @HttpCode(200)
  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
    return { ok: true };
  }

  @HttpCode(200)
  @Post(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }
}
