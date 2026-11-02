import { z } from 'zod';
import {
  LISTING_CONDITIONS,
  LISTING_SORTS,
  LISTING_STATUSES,
  LOCATION_TYPES,
  MAX_RADIUS_KM,
  OFFER_STATUSES,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  PRICE_MAX_BDT,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGETS,
  USER_ROLES,
  USER_STATUSES,
} from './constants';

const uuid = z.uuid();
const price = z.number().int('Enter a whole taka amount').min(1, 'Enter a price of at least ৳1').max(PRICE_MAX_BDT);
const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

// --- Auth ---
export const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')).pipe(z.string().max(254));
export const passwordField = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');
export const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Use 3 to 30 letters, numbers or underscores');

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(2, 'Enter your name').max(60),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: passwordField });
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128),
  newPassword: passwordField,
});

// --- Users ---
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your name').max(60).optional(),
  username: usernameField.optional(),
  bio: z.string().trim().max(500, 'Keep your bio under 500 characters').nullable().optional(),
  locationId: uuid.nullable().optional(),
  showSoldListings: z.boolean().optional(),
  defaultRadiusKm: z.number().int().min(1).max(MAX_RADIUS_KM).optional(),
  avatarImageId: uuid.nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// --- Listings ---
/** Drafts may be incomplete, so every field is optional here. See publishableListingSchema. */
export const listingDraftSchema = z.object({
  title: z.string().trim().max(100, 'Keep the title under 100 characters').nullable().optional(),
  description: z.string().trim().max(5000, 'Keep the description under 5000 characters').nullable().optional(),
  categoryId: uuid.nullable().optional(),
  condition: z.enum(LISTING_CONDITIONS).nullable().optional(),
  brand: z.string().trim().max(60).nullable().optional(),
  model: z.string().trim().max(60).nullable().optional(),
  priceBdt: price.nullable().optional(),
  originalPriceBdt: price.nullable().optional(),
  negotiable: z.boolean().optional(),
  locationId: uuid.nullable().optional(),
  meetupAvailable: z.boolean().optional(),
  deliveryAvailable: z.boolean().optional(),
  imageIds: z.array(uuid).max(30).optional(),
});
export type ListingDraftInput = z.infer<typeof listingDraftSchema>;

export const publishableListingSchema = z.object({
  title: z.string().trim().min(5, 'Enter a title of at least 5 characters').max(100),
  description: z.string().trim().min(20, 'Describe the item in at least 20 characters').max(5000),
  categoryId: uuid.describe('Choose a category'),
  condition: z.enum(LISTING_CONDITIONS),
  priceBdt: price,
  locationId: uuid,
  imageCount: z.number().int().min(1, 'Add at least one photo'),
});

export const markSoldSchema = z.object({
  soldToUserId: uuid.nullable().optional(),
  soldPriceBdt: price.nullable().optional(),
});

export const listingActionSchema = z.object({ action: z.enum(['pause', 'reactivate', 'archive']) });

export const listingQuerySchema = paginationQuery.extend({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).max(PRICE_MAX_BDT).optional(),
  maxPrice: z.coerce.number().int().min(0).max(PRICE_MAX_BDT).optional(),
  condition: z.union([z.enum(LISTING_CONDITIONS), z.array(z.enum(LISTING_CONDITIONS))]).optional(),
  /** Location slug. With radiusKm: nearby search. Without: listings in the location and its children. */
  location: z.string().trim().max(80).optional(),
  radiusKm: z.coerce.number().min(1).max(MAX_RADIUS_KM).optional(),
  availability: z.enum(['available', 'sold', 'all']).default('available'),
  sort: z.enum(LISTING_SORTS).optional(),
  sellerId: uuid.optional(),
  ids: z
    .string()
    .max(1000)
    .regex(/^[0-9a-f-]+(,[0-9a-f-]+)*$/i)
    .optional(),
});
export type ListingQuery = z.infer<typeof listingQuerySchema>;

export const myListingsQuerySchema = paginationQuery.extend({
  status: z.enum(LISTING_STATUSES).optional(),
});

export const suggestionsQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });

export const nearbyLocationsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// --- Offers ---
export const createOfferSchema = z.object({
  amountBdt: price,
  note: z.string().trim().max(300).optional(),
});
export const counterOfferSchema = z.object({ amountBdt: price });
export const offersQuerySchema = paginationQuery.extend({
  role: z.enum(['buyer', 'seller']).default('buyer'),
  status: z.enum(OFFER_STATUSES).optional(),
});

// --- Messaging ---
export const createConversationSchema = z.object({
  listingId: uuid,
  message: z.string().trim().min(1, 'Write a message').max(2000).optional(),
});
export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Write a message').max(2000, 'Keep messages under 2000 characters'),
});
export const messagesQuerySchema = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// --- Trust and safety ---
export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: uuid,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const createReviewSchema = z.object({
  listingId: uuid,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// --- Admin ---
export const adminUsersQuerySchema = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
});
export const adminUpdateUserSchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});
export const adminListingsQuerySchema = paginationQuery.extend({
  status: z.enum(LISTING_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});
export const moderateListingSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === 'approve' || (v.reason && v.reason.length >= 3), {
    message: 'Give a reason so the seller can fix the listing',
    path: ['reason'],
  });
export const adminReportsQuerySchema = paginationQuery.extend({
  status: z.enum(REPORT_STATUSES).optional(),
});
export const resolveReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(500).optional(),
});
export const categoryUpsertSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Use lowercase letters, numbers and hyphens'),
  parentId: uuid.nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional(),
});
export const locationUpsertSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Use lowercase letters, numbers and hyphens'),
  type: z.enum(LOCATION_TYPES),
  parentId: uuid.nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const platformSettingsSchema = z.object({
  maxListingImages: z.number().int().min(1).max(20),
  dailyPublishLimit: z.number().int().min(1).max(500),
  newAccountReviewDays: z.number().int().min(0).max(365),
  prohibitedKeywords: z.array(z.string().trim().min(2).max(60)).max(500),
  radiiKm: z.array(z.number().int().min(1).max(MAX_RADIUS_KM)).min(1).max(8),
  defaultRadiusKm: z.number().int().min(1).max(MAX_RADIUS_KM),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export { queryBool };
