import { describe, expect, it } from 'vitest';
import { matchProhibitedKeyword, ownerCanTransition } from './listing-state';
import { nextOfferStatus } from './offer-state';

describe('offer state machine', () => {
  it('lets only the seller respond to a pending offer', () => {
    expect(nextOfferStatus('PENDING', 'seller', 'accept')).toBe('ACCEPTED');
    expect(nextOfferStatus('PENDING', 'buyer', 'accept')).toBeNull();
    expect(nextOfferStatus('PENDING', 'seller', 'counter')).toBe('COUNTERED');
  });
  it('lets only the buyer accept a counter', () => {
    expect(nextOfferStatus('COUNTERED', 'buyer', 'accept')).toBe('ACCEPTED');
    expect(nextOfferStatus('COUNTERED', 'seller', 'accept')).toBeNull();
  });
  it('treats closed offers as final', () => {
    for (const status of ['REJECTED', 'CANCELLED', 'EXPIRED'] as const) {
      for (const action of ['accept', 'reject', 'counter', 'cancel'] as const) {
        expect(nextOfferStatus(status, 'buyer', action)).toBeNull();
        expect(nextOfferStatus(status, 'seller', action)).toBeNull();
      }
    }
  });
  it('allows either side to back out of an accepted offer', () => {
    expect(nextOfferStatus('ACCEPTED', 'buyer', 'cancel')).toBe('CANCELLED');
    expect(nextOfferStatus('ACCEPTED', 'seller', 'cancel')).toBe('CANCELLED');
    expect(nextOfferStatus('ACCEPTED', 'seller', 'reject')).toBeNull();
  });
});

describe('listing transitions', () => {
  it('cannot sell a draft or skip review after rejection', () => {
    expect(ownerCanTransition('DRAFT', 'SOLD')).toBe(false);
    expect(ownerCanTransition('REJECTED', 'ACTIVE')).toBe(false);
    expect(ownerCanTransition('ACTIVE', 'SOLD')).toBe(true);
  });
  it('cannot self-approve from review', () => {
    expect(ownerCanTransition('PENDING_REVIEW', 'ACTIVE')).toBe(false);
  });
});

describe('prohibited keyword matching', () => {
  it('matches whole words, regardless of punctuation or case', () => {
    expect(matchProhibitedKeyword('Original fake-passport here', ['passport'])).toBe('passport');
    expect(matchProhibitedKeyword('GUN for sale!', ['gun'])).toBe('gun');
  });
  it('does not match inside other words', () => {
    expect(matchProhibitedKeyword('Begun course books', ['gun'])).toBeNull();
  });
});
