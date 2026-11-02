import { describe, expect, it } from 'vitest';
import { formatBdt, formatDistance, listingIdFromParam, listingPath, slugify } from './format';
import { emailField, moderateListingSchema } from './schemas';

const id = '3f2b1c9e-7a44-4a11-9b1a-1234567890ab';

describe('format', () => {
  it('uses South Asian grouping for BDT', () => {
    expect(formatBdt(1250000)).toBe('৳12,50,000');
    expect(formatBdt(950)).toBe('৳950');
  });
  it('keeps Bangla text in slugs', () => {
    expect(slugify('পুরনো বই - Math!')).toBe('পুরনো-বই-math');
  });
  it('round-trips listing paths back to the id', () => {
    const path = listingPath({ id, title: 'HP Laptop, 8GB' });
    expect(path).toBe(`/listings/hp-laptop-8gb-${id}`);
    expect(listingIdFromParam(path.split('/').pop()!)).toBe(id);
    expect(listingIdFromParam('no-id-here')).toBeNull();
  });
  it('rounds distance so it never implies a precise location', () => {
    expect(formatDistance(0.3)).toBe('Under 1 km');
    expect(formatDistance(3.7)).toBe('3.5 km');
    expect(formatDistance(12.4)).toBe('12 km');
  });
});

describe('schemas', () => {
  it('normalises email', () => {
    expect(emailField.parse('  Me@Example.COM ')).toBe('me@example.com');
  });
  it('requires a reason to reject a listing', () => {
    expect(moderateListingSchema.safeParse({ decision: 'reject' }).success).toBe(false);
    expect(moderateListingSchema.safeParse({ decision: 'approve' }).success).toBe(true);
  });
});
