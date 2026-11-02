import type { ListingStatus } from '@sellnest/shared';

const OWNER_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ACTIVE', 'ARCHIVED'],
  PENDING_REVIEW: ['ARCHIVED'],
  ACTIVE: ['PAUSED', 'SOLD', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'SOLD', 'ARCHIVED'],
  // A rejected listing returns to moderators, never straight to ACTIVE.
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  SOLD: ['ARCHIVED'],
  ARCHIVED: [],
};

export function ownerCanTransition(from: ListingStatus, to: ListingStatus): boolean {
  return OWNER_TRANSITIONS[from].includes(to);
}

export const EDITABLE_STATUSES: ListingStatus[] = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED'];
/** Statuses anyone with the link can open. PAUSED and SOLD pages explain they are unavailable. */
export const PUBLIC_STATUSES: ListingStatus[] = ['ACTIVE', 'PAUSED', 'SOLD'];

export function matchProhibitedKeyword(text: string, keywords: string[]): string | null {
  const haystack = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return keywords.find((k) => haystack.includes(` ${k.toLowerCase().trim()} `)) ?? null;
}
