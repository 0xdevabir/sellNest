import type { ListingCard, Paginated, PublicProfile, ReviewItem } from '@sellnest/shared';
import { timeAgo } from '@sellnest/shared';
import { BadgeCheck, Star } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ListingGrid } from '@/components/listing-tile';
import { ProfileActions } from '@/components/profile-actions';
import { Avatar, EmptyState } from '@/components/ui';
import { ApiError, toQuery } from '@/lib/api';
import { serverApi } from '@/lib/server';

const load = cache(async (username: string) => {
  try {
    return await serverApi<PublicProfile>(`/users/${encodeURIComponent(username)}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await load((await params).username);
  return { title: `${profile.displayName} on SellNest`, alternates: { canonical: `/u/${profile.username}` } };
}

export default async function ProfilePage({ params }: Props) {
  const profile = await load((await params).username);
  const [listings, reviews] = await Promise.all([
    serverApi<Paginated<ListingCard>>(`/listings${toQuery({ sellerId: profile.id, availability: 'all', limit: 24, sort: 'newest' })}`),
    serverApi<Paginated<ReviewItem>>(`/users/${profile.username}/reviews`),
  ]);
  return (
    <main className="mx-auto max-w-7xl px-4 pt-7">
      <header className="flex flex-wrap items-start gap-4">
        <Avatar name={profile.displayName} url={profile.avatarUrl} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
            <span className="truncate">{profile.displayName}</span>
            {profile.emailVerified && <BadgeCheck aria-label="Email verified" className="size-5 shrink-0 text-accent-ink" />}
          </h1>
          <p className="text-muted">
            Joined {new Date(profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            {profile.location ? `, ${profile.location.name}` : ''}
          </p>
          {profile.reviewCount > 0 && profile.averageRating != null && (
            <p className="tabular mt-0.5 flex items-center gap-1">
              <Star className="size-4 fill-ink" aria-hidden />
              {profile.averageRating.toFixed(1)} from {profile.reviewCount} {profile.reviewCount === 1 ? 'review' : 'reviews'}
            </p>
          )}
          {profile.bio && <p className="mt-2 max-w-[68ch] whitespace-pre-line break-words">{profile.bio}</p>}
        </div>
        <ProfileActions profile={profile} />
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Listings</h2>
        {listings.items.length ? <ListingGrid listings={listings.items} /> : <EmptyState title={`${profile.displayName} has nothing listed right now`} />}
      </section>

      {reviews.items.length > 0 && (
        <section className="mt-12 max-w-2xl">
          <h2 className="mb-1 text-xl font-semibold">Reviews from buyers</h2>
          <ul>
            {reviews.items.map((r) => (
              <li key={r.id} className="border-b border-line py-3">
                <p className="tabular flex items-center gap-1 font-medium">
                  <Star className="size-4 fill-ink" aria-hidden />
                  {r.rating} of 5
                  <span className="ml-auto text-sm font-normal text-muted">{timeAgo(r.createdAt)}</span>
                </p>
                {r.comment && <p className="mt-1 whitespace-pre-line break-words">{r.comment}</p>}
                <p className="mt-1 text-sm text-muted">{r.reviewer.displayName}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
