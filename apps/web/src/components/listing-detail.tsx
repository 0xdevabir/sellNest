'use client';

import { formatBdt, type ImageVariants, type ListingDetail } from '@sellnest/shared';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Expand, Flag, MessageCircle, Share2 } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, errorMessage } from '@/lib/api';
import { rememberViewed } from './home';
import { FavoriteButton, ListingImage, srcSet } from './listing-tile';
import { useMe } from './providers';
import { ReportDialog } from './report-dialog';
import { Button, buttonClass, cx, Dialog, Field, Input, Notice, Textarea } from './ui';

export function Gallery({ images, title }: { images: ImageVariants[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = images[index] ?? null;
  const step = (d: number) => setIndex((i) => (i + d + images.length) % images.length);
  const arrow = 'absolute top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink hover:bg-surface';

  return (
    <div>
      <div className="relative overflow-hidden rounded-md bg-line">
        <ListingImage
          image={current}
          priority
          alt={`${title}, photo ${index + 1} of ${images.length}`}
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="aspect-[4/3] w-full"
        />
        {current && (
          <button type="button" aria-label="View photo full screen" onClick={() => setZoomed(true)} className="absolute bottom-2 right-2 inline-flex size-10 items-center justify-center rounded-md bg-surface/90 hover:bg-surface">
            <Expand className="size-5" aria-hidden />
          </button>
        )}
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={cx(arrow, 'left-2')}>
              <ChevronLeft aria-hidden />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => step(1)} className={cx(arrow, 'right-2')}>
              <ChevronRight aria-hidden />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cx('block overflow-hidden rounded-md border-2', i === index ? 'border-ink' : 'border-transparent')}
              >
                <ListingImage image={image} alt="" sizes="80px" className="h-14 w-20" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RadixDialog.Root open={zoomed} onOpenChange={setZoomed}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/95" />
          <RadixDialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center"
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') step(-1);
              if (e.key === 'ArrowRight') step(1);
            }}
          >
            <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
            <RadixDialog.Description className="sr-only">Full screen photo viewer</RadixDialog.Description>
            {current && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.urls['1600'] ?? Object.values(current.urls)[0]} srcSet={srcSet(current)} sizes="100vw" alt={`${title}, photo ${index + 1}`} className="max-h-full max-w-full object-contain" />
            )}
            <RadixDialog.Close className={buttonClass('outline', 'sm', 'absolute right-3 top-3')}>Close</RadixDialog.Close>
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className={cx(arrow, 'left-3')}>
                  <ChevronLeft aria-hidden />
                </button>
                <button type="button" aria-label="Next photo" onClick={() => step(1)} className={cx(arrow, 'right-3')}>
                  <ChevronRight aria-hidden />
                </button>
              </>
            )}
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </div>
  );
}

function OfferDialog({ listing, open, onOpenChange }: { listing: ListingDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= 1;
  const mutation = useMutation({
    mutationFn: () => api(`/listings/${listing.id}/offers`, { body: { amountBdt: value, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success('Offer sent');
      onOpenChange(false);
      router.refresh();
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Make an offer"
      description={`The asking price is ${formatBdt(listing.priceBdt)}. If the seller accepts, you still arrange payment and handover between you.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) mutation.mutate();
        }}
      >
        <Field label="Your offer (৳)" error={amount && !valid ? 'Enter a whole taka amount' : undefined}>
          {(p) => <Input {...p} inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />}
        </Field>
        <Field label="Note for the seller (optional)">
          {(p) => <Textarea {...p} rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {mutation.error && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}
        <Button type="submit" className="w-full" disabled={!valid} loading={mutation.isPending}>
          Send offer
        </Button>
      </form>
    </Dialog>
  );
}

export function ListingActions({ listing }: { listing: ListingDetail }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [offerOpen, setOfferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    rememberViewed(listing.id);
    if (!listing.isOwner) void api(`/listings/${listing.id}/view`, { method: 'POST' }).catch(() => undefined);
  }, [listing.id, listing.isOwner]);

  const signIn = () => router.push(`/login?next=${encodeURIComponent(pathname)}`);
  const contact = useMutation({
    mutationFn: () => api<{ id: string }>('/conversations', { body: { listingId: listing.id } }),
    onSuccess: (c) => router.push(`/inbox/${c.id}`),
    onError: (e) =>
      toast.error(e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED' ? 'Verify your email first. Find the link in Settings.' : errorMessage(e)),
  });
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // The person closed the share sheet.
    }
  };

  const available = listing.status === 'ACTIVE';
  const offer = listing.viewerOpenOffer;

  return (
    <div className="space-y-3">
      {listing.isOwner ? (
        <Link href={`/sell/${listing.id}`} className={buttonClass('primary', 'lg', 'w-full')}>
          Edit listing
        </Link>
      ) : available ? (
        <>
          {listing.viewerConversationId ? (
            <Link href={`/inbox/${listing.viewerConversationId}`} className={buttonClass('primary', 'lg', 'w-full')}>
              <MessageCircle className="size-5" aria-hidden />
              Open your conversation
            </Link>
          ) : (
            <Button size="lg" className="w-full" loading={contact.isPending} onClick={() => (me ? contact.mutate() : signIn())}>
              <MessageCircle className="size-5" aria-hidden />
              Message seller
            </Button>
          )}
          {offer ? (
            <Link href="/account/offers" className={buttonClass('outline', 'lg', 'w-full')}>
              Your offer: {formatBdt(offer.amountBdt)}
            </Link>
          ) : (
            listing.negotiable && (
              <Button variant="accent" size="lg" className="w-full" onClick={() => (me ? setOfferOpen(true) : signIn())}>
                Make an offer
              </Button>
            )
          )}
        </>
      ) : null}
      <div className="flex items-center gap-1">
        <FavoriteButton id={listing.id} initial={listing.isFavorite} withLabel className="h-10 px-3 hover:bg-accent-soft" />
        <button type="button" onClick={share} className="inline-flex h-10 items-center gap-2 rounded-md px-3 hover:bg-accent-soft">
          <Share2 className="size-5" aria-hidden />
          Share
        </button>
        {!listing.isOwner && (
          <button type="button" onClick={() => (me ? setReportOpen(true) : signIn())} className="ml-auto inline-flex h-10 items-center gap-2 rounded-md px-3 text-muted hover:bg-accent-soft">
            <Flag className="size-4" aria-hidden />
            Report
          </button>
        )}
      </div>
      <OfferDialog listing={listing} open={offerOpen} onOpenChange={setOfferOpen} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="LISTING" targetId={listing.id} title="Report this listing" />
    </div>
  );
}
