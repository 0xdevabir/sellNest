import type { OfferStatus } from '@sellnest/shared';

export type OfferAction = 'accept' | 'reject' | 'counter' | 'cancel';
export type OfferActor = 'buyer' | 'seller';

/**
 * The offer state machine. PENDING waits on the seller and COUNTERED waits on the buyer.
 * ACCEPTED is an agreement and not a sale: either side can back out, and only the seller's
 * deliberate "mark as sold" closes the listing.
 */
const TRANSITIONS: Partial<Record<OfferStatus, Partial<Record<OfferActor, Partial<Record<OfferAction, OfferStatus>>>>>> = {
  PENDING: {
    seller: { accept: 'ACCEPTED', reject: 'REJECTED', counter: 'COUNTERED' },
    buyer: { cancel: 'CANCELLED' },
  },
  COUNTERED: {
    buyer: { accept: 'ACCEPTED', reject: 'REJECTED', counter: 'PENDING', cancel: 'CANCELLED' },
    seller: { cancel: 'CANCELLED' },
  },
  ACCEPTED: {
    buyer: { cancel: 'CANCELLED' },
    seller: { cancel: 'CANCELLED' },
  },
};

export function nextOfferStatus(current: OfferStatus, actor: OfferActor, action: OfferAction): OfferStatus | null {
  return TRANSITIONS[current]?.[actor]?.[action] ?? null;
}

export const OPEN_OFFER_STATUSES: OfferStatus[] = ['PENDING', 'COUNTERED'];
