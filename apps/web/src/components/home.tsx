'use client';

import type { ListingCard, Paginated } from '@sellnest/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, toQuery } from '@/lib/api';
import { ListingGrid } from './listing-tile';
import { LocationDialog } from './location-picker';
import { useCatalog, useSetPlace } from './providers';
import { SearchBox } from './search-box';
import { Button } from './ui';

const VIEWED_KEY = 'sn_recently_viewed';

export function readViewed(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(VIEWED_KEY) ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberViewed(id: string) {
  try {
    localStorage.setItem(VIEWED_KEY, JSON.stringify([id, ...readViewed().filter((v) => v !== id)].slice(0, 10)));
  } catch {
    // Storage can be unavailable in private windows; this feature simply stays empty.
  }
}

/** The headline is the control: each underlined phrase opens the location picker. */
export function Hero() {
  const { place } = useCatalog();
  const [open, setOpen] = useState(false);
  const word = 'rounded-sm underline decoration-accent decoration-[3px] underline-offset-[6px] hover:decoration-accent-ink';
  return (
    <section className="pt-7 md:pt-10">
      <h1 className="text-[1.9rem] font-bold leading-[1.2] tracking-tight sm:text-[2.6rem]">
        Near{' '}
        <button type="button" onClick={() => setOpen(true)} className={word}>
          {place.name}
        </button>{' '}
        within{' '}
        <button type="button" onClick={() => setOpen(true)} className={`tabular ${word}`}>
          {place.radiusKm} km
        </button>
      </h1>
      <SearchBox large className="mt-5 max-w-2xl md:hidden" />
      <LocationDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}

export function RadiusExpander({ radiusKm }: { radiusKm: number }) {
  const { place } = useCatalog();
  const setPlace = useSetPlace();
  return <Button onClick={() => place.slug && setPlace(place.slug, radiusKm)}>Look within {radiusKm} km</Button>;
}

export function RecentlyViewed() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(readViewed()), []);
  const { data } = useQuery({
    queryKey: ['recently-viewed', ids],
    enabled: ids.length > 0,
    queryFn: () => api<Paginated<ListingCard>>(`/listings${toQuery({ ids: ids.join(','), availability: 'all', limit: 10 })}`),
  });
  if (!data?.items.length) return null;
  const order = new Map(ids.map((id, i) => [id, i]));
  const listings = [...data.items].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, 5);
  return (
    <section aria-labelledby="viewed" className="mt-12">
      <h2 id="viewed" className="mb-3 text-xl font-semibold">
        Recently viewed
      </h2>
      <ListingGrid listings={listings} />
    </section>
  );
}
