import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../../common/auth.decorators';
import {
  AdminListingsQueryDto,
  AdminReportsQueryDto,
  AdminUpdateUserDto,
  AdminUsersQueryDto,
  CategoryUpsertDto,
  LocationUpsertDto,
  ModerateListingDto,
  PaginationDto,
  PlatformSettingsDto,
  ResolveReportDto,
} from '../../common/dtos';
import { AdminService } from './admin.service';

/** Moderator access by default; catalogue, settings and audit routes narrow it to admins. */
@ApiTags('admin')
@Roles('MODERATOR', 'ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query() q: AdminUsersQueryDto) {
    return this.admin.users(q as never);
  }

  @Patch('users/:id')
  async updateUser(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto) {
    await this.admin.updateUser(actor, id, dto);
    return { ok: true };
  }

  @Get('listings')
  listings(@Query() q: AdminListingsQueryDto) {
    return this.admin.listings(q as never);
  }

  @HttpCode(200)
  @Post('listings/:id/moderate')
  async moderate(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ModerateListingDto) {
    await this.admin.moderate(actor, id, dto.decision, dto.reason);
    return { ok: true };
  }

  @Get('reports')
  reports(@Query() q: AdminReportsQueryDto) {
    return this.admin.reports(q as never);
  }

  @HttpCode(200)
  @Post('reports/:id/resolve')
  async resolve(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveReportDto) {
    await this.admin.resolveReport(actor, id, dto.status, dto.note);
    return { ok: true };
  }

  @Get('categories')
  categories() {
    return this.admin.allCategories();
  }

  @Roles('ADMIN')
  @Post('categories')
  createCategory(@CurrentUser() actor: AuthUser, @Body() dto: CategoryUpsertDto) {
    return this.admin.upsertCategory(actor, null, dto);
  }

  @Roles('ADMIN')
  @Put('categories/:id')
  updateCategory(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CategoryUpsertDto) {
    return this.admin.upsertCategory(actor, id, dto);
  }

  @Get('locations')
  locations() {
    return this.admin.allLocations();
  }

  @Roles('ADMIN')
  @Post('locations')
  createLocation(@CurrentUser() actor: AuthUser, @Body() dto: LocationUpsertDto) {
    return this.admin.upsertLocation(actor, null, dto);
  }

  @Roles('ADMIN')
  @Put('locations/:id')
  updateLocation(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: LocationUpsertDto) {
    return this.admin.upsertLocation(actor, id, dto);
  }

  @Roles('ADMIN')
  @Get('settings')
  settings() {
    return this.admin.getSettings();
  }

  @Roles('ADMIN')
  @Put('settings')
  updateSettings(@CurrentUser() actor: AuthUser, @Body() dto: PlatformSettingsDto) {
    return this.admin.updateSettings(actor, dto);
  }

  @Roles('ADMIN')
  @Get('audit')
  audit(@Query() q: PaginationDto) {
    const { page, limit } = q as unknown as { page: number; limit: number };
    return this.admin.auditLog(page, limit);
  }
}
