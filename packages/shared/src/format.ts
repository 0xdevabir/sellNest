/** Formats whole taka with South Asian digit grouping: 1250000 -> "৳12,50,000". */
export function formatBdt(amount: number): string {
  return `৳${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
}

export function slugify(input: string): string {
  return (
    input
      .normalize('NFKC')
      .toLowerCase()
      // Keep letters and marks from any script so Bangla titles still produce readable URLs.
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '')
  );
}

export function listingPath(listing: { id: string; title: string | null }): string {
  const slug = slugify(listing.title ?? '');
  return `/listings/${slug ? `${slug}-` : ''}${listing.id}`;
}

const UUID_AT_END = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function listingIdFromParam(param: string): string | null {
  return decodeURIComponent(param).match(UUID_AT_END)?.[0]?.toLowerCase() ?? null;
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km == null) return null;
  // Rounded on purpose: listing positions are area centres, so more precision would be false.
  if (km < 1) return 'Under 1 km';
  return `${km < 10 ? Math.round(km * 2) / 2 : Math.round(km)} km`;
}

export function timeAgo(iso: string | Date, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const units: [number, string][] = [
    [60, 'min'],
    [3600, 'hr'],
    [86400, 'day'],
    [604800, 'wk'],
    [2629800, 'mo'],
    [31557600, 'yr'],
  ];
  for (let i = units.length - 1; i >= 0; i--) {
    const [size, label] = units[i]!;
    if (seconds >= size) {
      const n = Math.floor(seconds / size);
      return `${n} ${label}${n > 1 && label !== 'min' && label !== 'hr' ? 's' : ''} ago`;
    }
  }
  return 'Just now';
}
