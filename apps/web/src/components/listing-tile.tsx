'use client';

import { CONDITION_LABELS, formatBdt, formatDistance, type ImageVariants, type ListingCard } from '@sellnest/shared';
import { useMutation } from '@tanstack/react-query';
import { Heart, ImageOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useMe } from './providers';
import { Badge, cx } from './ui';

export function srcSet(image: ImageVariants) {
  return Object.entries(image.urls)
    .map(([w, url]) => `${url} ${w}w`)
    .join(', ');
}

export function ListingImage({
  image,
  sizes,
  alt,
  className,
  priority,
}: {
  image: ImageVariants | null;
  sizes: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div role="img" aria-label="No photo" className={cx('flex items-center justify-center bg-line text-muted', className)}>
        <ImageOff className="size-6" aria-hidden />
      </div>
    );
  }
  const widths = Object.keys(image.urls).map(Number).sort((a, b) => a - b);
  return (
    // Variants are already resized WebP files on object storage, so srcset is all that is needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.urls[String(widths[Math.min(1, widths.length - 1)])]}
      srcSet={srcSet(image)}
      sizes={sizes}
      alt={alt}
      width={image.width}
      height={image.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cx('object-cover', className)}
    />
  );
}

export function FavoriteButton({
  id,
  initial,
  className,
  withLabel,
}: {
  id: string;
  initial: boolean;
  className?: string;
  withLabel?: boolean;
}) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initial);
  const mutation = useMutation({
    mutationFn: (next: boolean) => api(`/listings/${id}/favorite`, { method: next ? 'POST' : 'DELETE' }),
    onMutate: (next) => setSaved(next),
    onError: (e, next) => {
      setSaved(!next);
      toast.error(errorMessage(e));
    },
  });
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save listing'}
      onClick={(e) => {
        e.preventDefault();
        if (!me) router.push(`/login?next=${encodeURIComponent(pathname)}`);
        else mutation.mutate(!saved);
      }}
      className={cx('inline-flex items-center justify-center gap-2 rounded-md', className)}
    >
      <Heart className={cx('size-5', saved ? 'fill-danger text-danger' : 'text-ink')} aria-hidden />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  );
}

export function ListingTile({ listing, priority }: { listing: ListingCard; priority?: boolean }) {
  const distance = formatDistance(listing.distanceKm);
  const inactive = listing.status !== 'ACTIVE';
  return (
    <article className="group relative min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-line">
        <ListingImage
          image={listing.cover}
          alt=""
          priority={priority}
          sizes="(min-width: 1024px) 24vw, (min-width: 640px) 32vw, 48vw"
          className={cx('size-full', inactive && 'opacity-60')}
        />
        {inactive && (
          <span className="absolute left-2 top-2">
            <Badge tone="dark">{listing.status === 'SOLD' ? 'Sold' : 'Unavailable'}</Badge>
          </span>
        )}
      </div>
      <FavoriteButton
        id={listing.id}
        initial={listing.isFavorite}
        className="absolute right-1.5 top-1.5 z-10 size-9 bg-surface/90 hover:bg-surface"
      />
      <div className="tabular mt-2 text-lg font-bold leading-tight">{formatBdt(listing.priceBdt)}</div>
      <h3 className="mt-0.5 line-clamp-2 leading-snug">
        <Link href={listing.path} className="after:absolute after:inset-0 group-hover:underline">
          {listing.title}
        </Link>
      </h3>
      <p className="mt-0.5 truncate text-sm text-muted">
        {listing.locationName}
        {distance ? `, ${distance.toLowerCase()} away` : ''}
      </p>
      <p className="sr-only">Condition: {CONDITION_LABELS[listing.condition]}</p>
    </article>
  );
}

export function ListingGrid({ listings, priorityCount = 0 }: { listings: ListingCard[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((l, i) => (
        <ListingTile key={l.id} listing={l} priority={i < priorityCount} />
      ))}
    </div>
  );
}
