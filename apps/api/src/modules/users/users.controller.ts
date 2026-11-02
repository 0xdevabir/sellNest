import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ListingStatus } from '@sellnest/shared';
import { AuthUser, CurrentUser, Public, RateLimit } from '../../common/auth.decorators';
import { MyListingsQueryDto, PaginationDto, UpdateProfileDto } from '../../common/dtos';
import { ListingsService } from '../listings/listings.service';
import { UsersService } from './users.service';

interface PageQuery {
  page: number;
  limit: number;
}

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly listings: ListingsService,
  ) {}

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }

  @Get('me/listings')
  myListings(@CurrentUser() user: AuthUser, @Query() q: MyListingsQueryDto) {
    const { page, limit, status } = q as unknown as PageQuery & { status?: ListingStatus };
    return this.listings.mine(user.id, status, page, limit);
  }

  @Get('me/favorites')
  myFavorites(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    const { page, limit } = q as unknown as PageQuery;
    return this.listings.favorites(user.id, page, limit);
  }

  @Get('me/blocks')
  myBlocks(@CurrentUser() user: AuthUser) {
    return this.users.blocked(user.id);
  }

  @Public()
  @Get('users/:username')
  profile(@Param('username') username: string, @CurrentUser() viewer?: AuthUser) {
    return this.users.publicProfile(username, viewer);
  }

  @Public()
  @Get('users/:username/reviews')
  reviews(@Param('username') username: string, @Query() q: PaginationDto) {
    const { page, limit } = q as unknown as PageQuery;
    return this.users.reviews(username, page, limit);
  }

  @RateLimit({ name: 'block', limit: 30, windowSeconds: 3600, by: 'user' })
  @HttpCode(204)
  @Post('users/:id/block')
  block(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.block(user.id, id);
  }

  @HttpCode(204)
  @Delete('users/:id/block')
  unblock(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.unblock(user.id, id);
  }
}
