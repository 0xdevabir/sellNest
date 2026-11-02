import type {
  ListingCondition,
  ListingStatus,
  LocationType,
  NotificationType,
  OfferStatus,
  ReportReason,
  ReportStatus,
  ReportTarget,
  UserRole,
  UserStatus,
} from './constants';

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId?: string;
  };
}

export interface ImageVariants {
  id: string;
  width: number;
  height: number;
  /** Width in px mapped to public URL. */
  urls: Record<string, string>;
}

export interface PublicUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface Me extends PublicUserSummary {
  email: string;
  role: UserRole;
  status: UserStatus;
  bio: string | null;
  location: LocationSummary | null;
  showSoldListings: boolean;
  defaultRadiusKm: number;
  profileCompleted: boolean;
  createdAt: string;
  unreadMessages: number;
  unreadNotifications: number;
}

export interface PublicProfile extends PublicUserSummary {
  bio: string | null;
  location: LocationSummary | null;
  memberSince: string;
  activeListingCount: number;
  soldListingCount: number | null;
  reviewCount: number;
  averageRating: number | null;
  viewerHasBlocked: boolean;
}

export interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  type: LocationType;
}

export interface LocationNode extends LocationSummary {
  parentId: string | null;
  parentName: string | null;
  isFeatured: boolean;
}

export interface NearbyLocation extends LocationSummary {
  distanceKm: number;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  parentId: string | null;
  children: CategoryNode[];
}

export interface ListingCard {
  id: string;
  path: string;
  title: string;
  priceBdt: number;
  negotiable: boolean;
  condition: ListingCondition;
  status: ListingStatus;
  cover: ImageVariants | null;
  locationName: string;
  distanceKm: number | null;
  publishedAt: string | null;
  isFavorite: boolean;
}

export interface ListingDetail extends ListingCard {
  description: string;
  images: ImageVariants[];
  originalPriceBdt: number | null;
  brand: string | null;
  model: string | null;
  category: { id: string; slug: string; name: string; parent: { slug: string; name: string } | null };
  location: LocationSummary;
  meetupAvailable: boolean;
  deliveryAvailable: boolean;
  seller: PublicUserSummary & { memberSince: string; reviewCount: number; averageRating: number | null };
  isOwner: boolean;
  viewerConversationId: string | null;
  viewerOpenOffer: OfferSummary | null;
  rejectionReason: string | null;
}

/** Full editable record, returned to the owner only. */
export interface ListingEditable {
  id: string;
  status: ListingStatus;
  title: string | null;
  description: string | null;
  categoryId: string | null;
  condition: ListingCondition | null;
  brand: string | null;
  model: string | null;
  priceBdt: number | null;
  originalPriceBdt: number | null;
  negotiable: boolean;
  locationId: string | null;
  meetupAvailable: boolean;
  deliveryAvailable: boolean;
  images: ImageVariants[];
  rejectionReason: string | null;
  updatedAt: string;
  path: string;
}

export interface MyListing {
  id: string;
  path: string;
  title: string | null;
  priceBdt: number | null;
  status: ListingStatus;
  cover: ImageVariants | null;
  viewCount: number;
  favoriteCount: number;
  openOfferCount: number;
  conversationCount: number;
  rejectionReason: string | null;
  updatedAt: string;
}

export interface OfferSummary {
  id: string;
  amountBdt: number;
  note: string | null;
  status: OfferStatus;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfferDetail extends OfferSummary {
  listing: { id: string; path: string; title: string; status: ListingStatus; priceBdt: number; cover: ImageVariants | null };
  buyer: PublicUserSummary;
  seller: PublicUserSummary;
  conversationId: string | null;
  events: { id: string; type: string; amountBdt: number | null; actorId: string; createdAt: string }[];
}

export interface ConversationSummary {
  id: string;
  listing: { id: string; path: string; title: string; priceBdt: number; status: ListingStatus; cover: ImageVariants | null };
  other: PublicUserSummary;
  role: 'buyer' | 'seller';
  lastMessage: { body: string; createdAt: string; senderId: string | null } | null;
  unreadCount: number;
  otherLastReadAt: string | null;
  blocked: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  type: 'TEXT' | 'SYSTEM';
  body: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: PublicUserSummary;
  listingTitle: string;
}

export interface PublicConfig {
  radiiKm: number[];
  defaultRadiusKm: number;
  defaultLocationSlug: string | null;
  maxListingImages: number;
  uploadsEnabled: boolean;
}

export interface AdminOverview {
  totalUsers: number;
  newUsers7d: number;
  activeUsers7d: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  pendingListings: number;
  newListings7d: number;
  openReports: number;
  reports7d: number;
  messages7d: number;
  offers7d: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  listingCount: number;
}

export interface AdminListing {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  priceBdt: number | null;
  status: ListingStatus;
  isDemo: boolean;
  flagReason: string | null;
  cover: ImageVariants | null;
  seller: { id: string; username: string; displayName: string; createdAt: string };
  createdAt: string;
}

export interface AdminReport {
  id: string;
  targetType: ReportTarget;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  note: string | null;
  createdAt: string;
  reporter: { id: string; username: string };
  target: { label: string; href: string | null; excerpt: string | null };
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; username: string } | null;
}
