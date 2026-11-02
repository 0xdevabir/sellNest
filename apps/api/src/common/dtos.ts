import * as s from '@sellnest/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(s.registerSchema) {}
export class LoginDto extends createZodDto(s.loginSchema) {}
export class ForgotPasswordDto extends createZodDto(s.forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(s.resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(s.verifyEmailSchema) {}
export class ChangePasswordDto extends createZodDto(s.changePasswordSchema) {}
export class UpdateProfileDto extends createZodDto(s.updateProfileSchema) {}
export class PaginationDto extends createZodDto(s.paginationQuery) {}
export class ListingDraftDto extends createZodDto(s.listingDraftSchema) {}
export class MarkSoldDto extends createZodDto(s.markSoldSchema) {}
export class ListingActionDto extends createZodDto(s.listingActionSchema) {}
export class ListingQueryDto extends createZodDto(s.listingQuerySchema) {}
export class MyListingsQueryDto extends createZodDto(s.myListingsQuerySchema) {}
export class SuggestionsQueryDto extends createZodDto(s.suggestionsQuerySchema) {}
export class NearbyLocationsQueryDto extends createZodDto(s.nearbyLocationsQuerySchema) {}
export class CreateOfferDto extends createZodDto(s.createOfferSchema) {}
export class CounterOfferDto extends createZodDto(s.counterOfferSchema) {}
export class OffersQueryDto extends createZodDto(s.offersQuerySchema) {}
export class CreateConversationDto extends createZodDto(s.createConversationSchema) {}
export class SendMessageDto extends createZodDto(s.sendMessageSchema) {}
export class MessagesQueryDto extends createZodDto(s.messagesQuerySchema) {}
export class CreateReportDto extends createZodDto(s.createReportSchema) {}
export class CreateReviewDto extends createZodDto(s.createReviewSchema) {}
export class AdminUsersQueryDto extends createZodDto(s.adminUsersQuerySchema) {}
export class AdminUpdateUserDto extends createZodDto(s.adminUpdateUserSchema) {}
export class AdminListingsQueryDto extends createZodDto(s.adminListingsQuerySchema) {}
export class ModerateListingDto extends createZodDto(s.moderateListingSchema) {}
export class AdminReportsQueryDto extends createZodDto(s.adminReportsQuerySchema) {}
export class ResolveReportDto extends createZodDto(s.resolveReportSchema) {}
export class CategoryUpsertDto extends createZodDto(s.categoryUpsertSchema) {}
export class LocationUpsertDto extends createZodDto(s.locationUpsertSchema) {}
export class PlatformSettingsDto extends createZodDto(s.platformSettingsSchema) {}

export function paginated<T>(items: T[], total: number, page: number, limit: number): s.Paginated<T> {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
