import type { ListingCard, Paginated } from '@sellnest/shared';
import Link from 'next/link';
import { Hero, RadiusExpander, RecentlyViewed } from '@/components/home';
import { ListingGrid } from '@/components/listing-tile';
import { EmptyState } from '@/components/ui';
import { buttonClass } from '@/components/ui-core';
import { toQuery } from '@/lib/api';
import { getCatalog, getPlace, serverApi } from '@/lib/server';

export default async function HomePage() {
  const [{ categories, config }, place] = await Promise.all([getCatalog(), getPlace()]);
  const [nearby, recent, popular] = await Promise.all([
    serverApi<Paginated<ListingCard>>(
      `/search${toQuery({ location: place.slug, radiusKm: place.slug ? place.radiusKm : undefined, sort: 'nearest', limit: 12 })}`,
    ),
    serverApi<Paginated<ListingCard>>(`/search${toQuery({ sort: 'newest', limit: 10 })}`),
    serverApi<{ slug: string; name: string; count: number }[]>('/categories/popular'),
  ]);
  const wider = config.radiiKm.find((r) => r > place.radiusKm);

  return (
    <main className="mx-auto max-w-7xl px-4">
      <Hero />
      <nav aria-label="Categories" className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <Link key={c.id} href={`/explore?category=${c.slug}`} className={buttonClass('outline', 'sm', 'shrink-0 font-normal')}>
            {c.name}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="nearby" className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="nearby" className="sr-only">
            Listings near {place.name}
          </h2>
          <p className="tabular text-muted">
            {nearby.total} {nearby.total === 1 ? 'listing' : 'listings'} nearby
          </p>
          {nearby.total > nearby.items.length && (
            <Link className="font-medium underline" href={`/explore${toQuery({ location: place.slug, radiusKm: place.radiusKm })}`}>
              See all
            </Link>
          )}
        </div>
        {nearby.items.length > 0 ? (
          <ListingGrid listings={nearby.items} priorityCount={4} />
        ) : (
          <EmptyState
            title={`Nothing within ${place.radiusKm} km of ${place.name} yet`}
            action={
              <>
                {wider && <RadiusExpander radiusKm={wider} />}
                <Link href="/sell" className={buttonClass('outline')}>
                  List the first item here
                </Link>
              </>
            }
          >
            {wider ? `Look a little further out, or be the first to sell here.` : 'Try a different area, or be the first to sell here.'}
          </EmptyState>
        )}
      </section>

      <section className="mt-12 flex flex-col justify-between gap-4 rounded-lg bg-ink px-6 py-7 text-white sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Clearing out your room?</h2>
          <p className="mt-1 text-white/75">Take a few photos and your item is in front of people nearby. Listing is free.</p>
        </div>
        <Link href="/sell" className={buttonClass('accent', 'md', 'shrink-0')}>
          Sell an item
        </Link>
      </section>

      {recent.items.length > 0 && (
        <section aria-labelledby="recent" className="mt-12">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="recent" className="text-xl font-semibold">
              Just listed everywhere
            </h2>
            <Link className="font-medium underline" href="/explore?location=all&sort=newest">
              See all
            </Link>
          </div>
          <ListingGrid listings={recent.items} />
        </section>
      )}

      {popular.length > 0 && (
        <section aria-labelledby="popular" className="mt-12">
          <h2 id="popular" className="mb-3 text-xl font-semibold">
            What people are selling
          </h2>
          <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((c) => (
              <li key={c.slug} className="border-b border-line">
                <Link href={`/explore?category=${c.slug}`} className="flex items-baseline justify-between py-3 hover:underline">
                  <span className="font-medium">{c.name}</span>
                  <span className="tabular text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecentlyViewed />
    </main>
  );
}
