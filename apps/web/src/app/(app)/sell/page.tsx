import type { MyListing, Paginated } from '@sellnest/shared';
import { timeAgo } from '@sellnest/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { StartListingButton } from '@/components/sell-wizard';
import { ListingImage } from '@/components/listing-tile';
import { Notice } from '@/components/ui';
import { getCatalog, requireUser, serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Sell an item' };

export default async function SellPage() {
  const me = await requireUser('/sell');
  const [{ config }, drafts] = await Promise.all([getCatalog(), serverApi<Paginated<MyListing>>('/me/listings?status=DRAFT&limit=10')]);
  return (
    <main className="mx-auto max-w-2xl px-4 pt-8">
      <h1 className="text-2xl font-bold tracking-tight">Sell an item</h1>
      <p className="mt-1 text-muted">Add photos, say what it is, choose where to hand it over. Listing is free.</p>
      <div className="mt-4 space-y-3">
        {!me.emailVerified && (
          <Notice tone="warn">
            You can save a draft now, but you need to verify your email before you can publish.{' '}
            <Link className="underline" href="/account/settings">
              Send a new link
            </Link>
          </Notice>
        )}
        {!config.uploadsEnabled && <Notice tone="warn">Photo uploads are not set up on this server yet, so listings cannot be published.</Notice>}
      </div>
      <StartListingButton />
      {drafts.items.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-lg font-semibold">Pick up where you left off</h2>
          <ul>
            {drafts.items.map((d) => (
              <li key={d.id} className="border-b border-line">
                <Link href={`/sell/${d.id}`} className="flex items-center gap-3 py-2.5 hover:underline">
                  <ListingImage image={d.cover} alt="" sizes="64px" className="h-12 w-16 shrink-0 rounded" />
                  <span className="min-w-0 flex-1 truncate font-medium">{d.title || 'Untitled draft'}</span>
                  <span className="shrink-0 text-sm text-muted">{timeAgo(d.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-sm text-muted">
        Some items cannot be sold here. Check the{' '}
        <Link className="underline" href="/prohibited-items">
          prohibited items
        </Link>
        .
      </p>
    </main>
  );
}
