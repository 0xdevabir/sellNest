import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { OfferStatus } from '@sellnest/shared';
import { AuthUser, CurrentUser, RateLimit, VerifiedOnly } from '../../common/auth.decorators';
import { CounterOfferDto, CreateOfferDto, OffersQueryDto } from '../../common/dtos';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller()
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @VerifiedOnly()
  @RateLimit({ name: 'create-offer', limit: 20, windowSeconds: 3600, by: 'user' })
  @Post('listings/:id/offers')
  create(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateOfferDto) {
    return this.offers.create(user, id, dto.amountBdt, dto.note);
  }

  @Get('offers')
  list(@CurrentUser() user: AuthUser, @Query() q: OffersQueryDto) {
    const { role, status, page, limit } = q as unknown as {
      role: 'buyer' | 'seller';
      status?: OfferStatus;
      page: number;
      limit: number;
    };
    return this.offers.list(user.id, role, status, page, limit);
  }

  @Get('offers/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.detail(id, user.id);
  }

  @HttpCode(200)
  @Post('offers/:id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.act(user, id, 'accept');
  }

  @HttpCode(200)
  @Post('offers/:id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.act(user, id, 'reject');
  }

  @HttpCode(200)
  @Post('offers/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.offers.act(user, id, 'cancel');
  }

  @HttpCode(200)
  @Post('offers/:id/counter')
  counter(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CounterOfferDto) {
    return this.offers.act(user, id, 'counter', dto.amountBdt);
  }
}
