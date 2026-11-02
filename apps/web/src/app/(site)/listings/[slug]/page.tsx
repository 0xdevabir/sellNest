import {
  CONDITION_LABELS,
  formatBdt,
  formatDistance,
  listingIdFromParam,
  STATUS_LABELS,
  timeAgo,
  type ListingCard,
  type ListingDetail,
  type Paginated,
} from '@sellnest/shared';
import { BadgeCheck, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { Gallery, ListingActions } from '@/components/listing-detail';
import { ListingGrid } from '@/components/listing-tile';
import { Avatar, Badge, Notice } from '@/components/ui';
import { ApiError, toQuery } from '@/lib/api';
import { getPlace, serverApi } from '@/lib/server';

const load = cache(async (slug: string) => {
  const id = listingIdFromParam(slug);
  if (!id) notFound();
  const place = await getPlace();
  try {
    return await serverApi<ListingDetail>(`/listings/${id}${toQuery({ location: place.slug })}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await load((await params).slug);
  const description = listing.description.slice(0, 155);
  const image = listing.images[0]?.urls['800'];
  return {
    title: `${listing.title}, ${formatBdt(listing.priceBdt)}`,
    description,
    alternates: { canonical: listing.path },
    robots: listing.status === 'ACTIVE' || listing.status === 'SOLD' ? undefined : { index: false },
    openGraph: { title: listing.title, description, images: image ? [image] : undefined, url: listing.path },
  };
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = await load(slug);
  if (decodeURIComponent(slug) !== decodeURIComponent(listing.path.split('/').pop()!)) permanentRedirect(listing.path);

  const [others, similar] = await Promise.all([
    serverApi<Paginated<ListingCard>>(`/listings${toQuery({ sellerId: listing.seller.id, limit: 6, sort: 'newest' })}`),
    serverApi<Paginated<ListingCard>>(`/listings${toQuery({ category: listing.category.slug, limit: 6, sort: 'newest' })}`),
  ]);
  const distance = formatDistance(listing.distanceKm);
  const unavailable = listing.status !== 'ACTIVE';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: listing.images.map((i) => i.urls['800']).filter(Boolean),
    offers: {
      '@type': 'Offer',
      price: listing.priceBdt,
      priceCurrency: 'BDT',
      availability: listing.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      itemCondition: listing.condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    },
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pt-5">
      {/* Escaping "<" stops listing text from closing the script element. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted">
        <Link className="hover:underline" href="/explore">
          Explore
        </Link>
        {listing.category.parent && (
          <>
            {' / '}
            <Link className="hover:underline" href={`/explore?category=${listing.category.parent.slug}`}>
              {listing.category.parent.name}
            </Link>
          </>
        )}
        {' / '}
        <Link className="hover:underline" href={`/explore?category=${listing.category.slug}`}>
          {listing.category.name}
        </Link>
      </nav>

      {listing.isOwner && listing.status === 'REJECTED' && listing.rejectionReason && (
        <div className="mb-4">
          <Notice tone="danger">Moderators rejected this listing: {listing.rejectionReason}</Notice>
        </div>
      )}
      {listing.isOwner && listing.status === 'PENDING_REVIEW' && (
        <div className="mb-4">
          <Notice tone="warn">This listing is waiting for review. Only you can see it until it is approved.</Notice>
        </div>
      )}
      {unavailable && !listing.isOwner && (
        <div className="mb-4">
          <Notice tone="warn">{listing.status === 'SOLD' ? 'This item has been sold.' : 'This listing is not available right now.'}</Notice>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        <div className="min-w-0">
          <Gallery images={listing.images} title={listing.title} />
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="mt-1 max-w-[68ch] whitespace-pre-line break-words">{listing.description}</p>
          </section>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {unavailable && <Badge tone="dark">{STATUS_LABELS[listing.status]}</Badge>}
            {listing.isDemo && <Badge tone="warn">Sample listing</Badge>}
          </div>
          <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight">{listing.title}</h1>
          <p className="tabular mt-2 text-3xl font-bold">{formatBdt(listing.priceBdt)}</p>
          <p className="tabular text-muted">
            {listing.negotiable ? 'Price is negotiable' : 'Fixed price'}
            {listing.originalPriceBdt ? `. Originally ${formatBdt(listing.originalPriceBdt)}` : ''}
          </p>
          <div className="mt-4">
            <ListingActions listing={listing} />
          </div>
          <dl className="mt-5">
            <Spec label="Condition" value={CONDITION_LABELS[listing.condition]} />
            {listing.brand && <Spec label="Brand" value={listing.brand} />}
            {listing.model && <Spec label="Model" value={listing.model} />}
            <Spec label="Category" value={listing.category.name} />
            <Spec label="Approximate area" value={distance ? `${listing.location.name}, ${distance.toLowerCase()} away` : listing.location.name} />
            <Spec
              label="Handover"
              value={[listing.meetupAvailable && 'Meet in person', listing.deliveryAvailable && 'Seller can deliver'].filter(Boolean).join(' or ') || 'Ask the seller'}
            />
            {listing.publishedAt && <Spec label="Listed" value={timeAgo(listing.publishedAt)} />}
          </dl>
          <Link href={`/u/${listing.seller.username}`} className="mt-5 flex items-center gap-3 rounded-md border border-line bg-surface p-3 hover:bg-accent-soft">
            <Avatar name={listing.seller.displayName} url={listing.seller.avatarUrl} size={44} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 font-semibold">
                <span className="truncate">{listing.seller.displayName}</span>
                {listing.seller.emailVerified && <BadgeCheck aria-label="Email verified" className="size-4 shrink-0 text-accent-ink" />}
              </span>
              <span className="block text-sm text-muted">
                Joined {new Date(listing.seller.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </span>
              {listing.seller.reviewCount > 0 && listing.seller.averageRating != null && (
                <span className="tabular flex items-center gap-1 text-sm">
                  <Star className="size-3.5 fill-ink" aria-hidden />
                  {listing.seller.averageRating.toFixed(1)} from {listing.seller.reviewCount} {listing.seller.reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              )}
            </span>
          </Link>
          <p className="mt-4 text-sm text-muted">
            SellNest does not handle payment or delivery. Meet somewhere public and check the item before you pay.{' '}
            <Link href="/safety" className="underline">
              Safety tips
            </Link>
          </p>
        </div>
      </div>

      {others.items.filter((l) => l.id !== listing.id).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-xl font-semibold">More from {listing.seller.displayName}</h2>
          <ListingGrid listings={others.items.filter((l) => l.id !== listing.id).slice(0, 5)} />
        </section>
      )}
      {similar.items.filter((l) => l.id !== listing.id).length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-xl font-semibold">Similar items</h2>
          <ListingGrid listings={similar.items.filter((l) => l.id !== listing.id).slice(0, 5)} />
        </section>
      )}
    </main>
  );
}
