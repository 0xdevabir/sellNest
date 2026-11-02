import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ListingQuery } from '@sellnest/shared';
import { AuthedRequest, AuthUser, CurrentUser, Public, RateLimit, VerifiedOnly } from '../../common/auth.decorators';
import { ListingActionDto, ListingDraftDto, ListingQueryDto, MarkSoldDto, SuggestionsQueryDto } from '../../common/dtos';
import { ListingsService } from './listings.service';
import { SearchService } from './search.service';

@ApiTags('listings')
@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly searchService: SearchService,
  ) {}

  @Public()
  @RateLimit({ name: 'browse', limit: 120, windowSeconds: 60 })
  @Get('listings')
  browse(@Query() query: ListingQueryDto, @CurrentUser() viewer?: AuthUser) {
    return this.searchService.search(query as unknown as ListingQuery, viewer?.id);
  }

  @Public()
  @RateLimit({ name: 'search', limit: 120, windowSeconds: 60 })
  @Get('search')
  search(@Query() query: ListingQueryDto, @CurrentUser() viewer?: AuthUser) {
    return this.searchService.search(query as unknown as ListingQuery, viewer?.id);
  }

  @Public()
  @RateLimit({ name: 'suggest', limit: 90, windowSeconds: 60 })
  @Get('search/suggestions')
  suggestions(@Query() query: SuggestionsQueryDto) {
    return this.searchService.suggestions(query.q);
  }

  @RateLimit({ name: 'create-listing', limit: 30, windowSeconds: 3600, by: 'user' })
  @Post('listings')
  create(@CurrentUser() user: AuthUser) {
    return this.listings.createDraft(user);
  }

  @Public()
  @Get('listings/:id')
  detail(@Param('id', ParseUUIDPipe) id: string, @Query('location') location: unknown, @CurrentUser() viewer?: AuthUser) {
    return this.listings.detail(id, viewer, typeof location === 'string' ? location : undefined);
  }

  @Get('listings/:id/edit')
  editable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.editable(id, user.id);
  }

  @Patch('listings/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: ListingDraftDto) {
    return this.listings.update(id, user, dto);
  }

  @Delete('listings/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.remove(id, user);
  }

  @VerifiedOnly()
  @HttpCode(200)
  @Post('listings/:id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.publish(id, user);
  }

  @HttpCode(200)
  @Post('listings/:id/mark-sold')
  markSold(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: MarkSoldDto) {
    return this.listings.markSold(id, user, dto.soldToUserId, dto.soldPriceBdt);
  }

  @HttpCode(200)
  @Post('listings/:id/status')
  status(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: ListingActionDto) {
    return this.listings.applyAction(id, user, dto.action);
  }

  @Get('listings/:id/buyers')
  buyers(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.potentialBuyers(id, user.id);
  }

  @Public()
  @RateLimit({ name: 'view', limit: 120, windowSeconds: 60 })
  @HttpCode(204)
  @Post('listings/:id/view')
  async view(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    await this.listings.recordView(id, req.user?.id ?? req.ip ?? 'anon', req.user?.id);
  }

  @HttpCode(200)
  @Post('listings/:id/favorite')
  favorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.setFavorite(id, user.id, true);
  }

  @Delete('listings/:id/favorite')
  unfavorite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.listings.setFavorite(id, user.id, false);
  }
}
