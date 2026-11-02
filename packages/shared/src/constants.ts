export const LISTING_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS', 'REFURBISHED'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];
export const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
  FOR_PARTS: 'For parts',
  REFURBISHED: 'Refurbished',
};

export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
  'REJECTED',
  'SOLD',
  'ARCHIVED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'In review',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  REJECTED: 'Rejected',
  SOLD: 'Sold',
  ARCHIVED: 'Archived',
};

export const OFFER_STATUSES = [
  'PENDING',
  'COUNTERED',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const USER_ROLES = ['USER', 'MODERATOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LOCATION_TYPES = [
  'COUNTRY',
  'DIVISION',
  'DISTRICT',
  'CITY',
  'AREA',
  'CAMPUS',
  'COMMUNITY',
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const REPORT_REASONS = [
  'COUNTERFEIT',
  'STOLEN',
  'FRAUD',
  'PROHIBITED',
  'SPAM',
  'MISLEADING',
  'HARASSMENT',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  COUNTERFEIT: 'Counterfeit goods',
  STOLEN: 'Possibly stolen',
  FRAUD: 'Fraud or scam',
  PROHIBITED: 'Prohibited item',
  SPAM: 'Spam',
  MISLEADING: 'Misleading',
  HARASSMENT: 'Harassment or abuse',
  OTHER: 'Something else',
};

export const REPORT_TARGETS = ['LISTING', 'USER', 'MESSAGE', 'CONVERSATION'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'NEW_MESSAGE',
  'NEW_OFFER',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_COUNTERED',
  'OFFER_CANCELLED',
  'LISTING_APPROVED',
  'LISTING_REJECTED',
  'LISTING_SOLD',
  'ACCOUNT_SECURITY',
  'REVIEW_RECEIVED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const LISTING_SORTS = ['relevance', 'newest', 'price_asc', 'price_desc', 'nearest'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];
export const SORT_LABELS: Record<ListingSort, string> = {
  relevance: 'Best match',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  nearest: 'Nearest',
};

export const DEFAULT_RADII_KM = [3, 5, 10, 25] as const;
export const MAX_RADIUS_KM = 100;
export const PRICE_MAX_BDT = 100_000_000;
export const PAGE_SIZE_DEFAULT = 24;
export const PAGE_SIZE_MAX = 48;

/** Image rules are mirrored on the client only for fast feedback; the API re-checks them all. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIN_DIMENSION = 320;
export const IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_VARIANT_WIDTHS = [320, 800, 1600] as const;
export const DEFAULT_MAX_LISTING_IMAGES = 8;

export const SESSION_COOKIE = 'sn_session';
export const LOCATION_COOKIE = 'sn_location';
