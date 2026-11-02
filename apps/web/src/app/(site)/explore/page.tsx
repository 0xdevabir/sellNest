import type { ListingCard, Paginated } from '@sellnest/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DesktopFilters, MobileFilters, ResetFilters, SortSelect } from '@/components/explore-filters';
import { ListingGrid } from '@/components/listing-tile';
import { SearchBox } from '@/components/search-box';
import { EmptyState } from '@/components/ui';
import { Pagination } from '@/components/ui-core';
import { ApiError, toQuery } from '@/lib/api';
import { getCatalog, getPlace, serverApi } from '@/lib/server';

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const params = await searchParams;
  const { categories } = await getCatalog();
  const slug = one(params.category);
  const category = categories.flatMap((c) => [c, ...c.children]).find((c) => c.slug === slug);
  const onlyCategory = Object.keys(params).every((k) => k === 'category');
  return {
    title: category ? `${category.name} for sale near you` : 'Explore listings',
    alternates: { canonical: category ? `/explore?category=${category.slug}` : '/explore' },
    // Filter combinations are endless; only the plain category pages should be indexed.
    robots: onlyCategory ? undefined : { index: false, follow: true },
  };
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const place = await getPlace();
  const locationParam = one(params.location);
  const location = locationParam === 'all' ? undefined : (locationParam ?? place.slug ?? undefined);
  const q = one(params.q);
  const query = toQuery({
    q,
    category: one(params.category),
    minPrice: one(params.minPrice),
    maxPrice: one(params.maxPrice),
    condition: params.condition ? [params.condition].flat() : undefined,
    availability: one(params.availability),
    location,
    radiusKm: location ? (one(params.radiusKm) ?? place.radiusKm) : undefined,
    sort: one(params.sort) ?? (q ? 'relevance' : location ? 'nearest' : 'newest'),
    page: one(params.page),
  });

  let result: Paginated<ListingCard> | null = null;
  let error: string | null = null;
  try {
    result = await serverApi<Paginated<ListingCard>>(`/search${query}`);
  } catch (e) {
    // Hand-edited URLs can hold invalid values, which should not take the page down.
    if (e instanceof ApiError && e.status < 500) error = 'Some of those filters are not valid. Reset them and try again.';
    else throw e;
  }

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== 'page') [v ?? []].flat().forEach((x) => next.append(k, x));
    next.set('page', String(page));
    return `/explore?${next.toString()}`;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pt-5">
      <h1 className="sr-only">Explore listings</h1>
      <SearchBox large initial={q} className="mb-4 md:hidden" />
      <div className="flex gap-8">
        <Suspense>
          <DesktopFilters />
        </Suspense>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="tabular text-muted" role="status">
              {result ? `${result.total} ${result.total === 1 ? 'listing' : 'listings'}${q ? ` for "${q}"` : ''}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <Suspense>
                <MobileFilters />
                <SortSelect />
              </Suspense>
            </div>
          </div>
          {error || !result?.items.length ? (
            <EmptyState title={error ? 'Check those filters' : 'No listings match'} action={<ResetFilters />}>
              {error ?? 'Try a wider distance, fewer filters or a different search.'}
            </EmptyState>
          ) : (
            <>
              <ListingGrid listings={result.items} priorityCount={4} />
              <Pagination page={result.page} totalPages={result.totalPages} href={pageHref} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
