import type { ListingCard, Paginated } from '@sellnest/shared';
import type { MetadataRoute } from 'next';

const site = (process.env.WEB_URL ?? 'http://localhost:3100').replace(/\/$/, '');
const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';
const MAX_PAGES = 200;

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ['', '/explore', '/safety', '/prohibited-items', '/terms', '/privacy', '/contact'].map((path) => ({ url: `${site}${path}` }));
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(`${api}/api/v1/listings?sort=newest&limit=48&page=${page}`, { cache: 'no-store' });
      if (!res.ok) break;
      const data = (await res.json()) as Paginated<ListingCard>;
      entries.push(...data.items.map((l) => ({ url: `${site}${l.path}` })));
      if (page >= data.totalPages) break;
    }
  } catch {
    // The API being down should not take the static part of the sitemap with it.
  }
  return entries;
}
