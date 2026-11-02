'use client';

import {
  formatBdt,
  STATUS_LABELS,
  timeAgo,
  type ListingCard,
  type MyListing,
  type OfferDetail,
  type OfferStatus,
  type Paginated,
  type PublicUserSummary,
} from '@sellnest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage, toQuery } from '@/lib/api';
import { ListingGrid, ListingImage } from './listing-tile';
import { useMe } from './providers';
import { Badge, Button, buttonClass, ConfirmDialog, cx, Dialog, EmptyState, Field, Input, Notice, Select, Textarea } from './ui';

const TABS = [
  { href: '/account', label: 'My listings' },
  { href: '/account/drafts', label: 'Drafts' },
  { href: '/account/favorites', label: 'Saved' },
  { href: '/inbox', label: 'Messages' },
  { href: '/account/offers', label: 'Offers' },
  { href: '/account/settings', label: 'Settings' },
];

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={pathname === t.href ? 'page' : undefined}
          className={cx('-mb-px shrink-0 border-b-[3px] px-2.5 py-2.5', pathname === t.href ? 'border-ink font-semibold' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

function MarkSoldDialog({ listing, open, onOpenChange, onDone }: { listing: MyListing; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [buyer, setBuyer] = useState('');
  const [price, setPrice] = useState('');
  const buyers = useQuery({
    queryKey: ['buyers', listing.id],
    enabled: open,
    queryFn: () => api<PublicUserSummary[]>(`/listings/${listing.id}/buyers`),
  });
  const mutation = useMutation({
    mutationFn: () => api(`/listings/${listing.id}/mark-sold`, { body: { soldToUserId: buyer || null, soldPriceBdt: price ? Number(price) : null } }),
    onSuccess: () => {
      toast.success('Marked as sold');
      onOpenChange(false);
      onDone();
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Mark as sold" description="The listing stops appearing in searches. Choosing the buyer lets them leave you a review.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Who bought it?">
          {(p) => (
            <Select {...p} value={buyer} onChange={(e) => setBuyer(e.target.value)}>
              <option value="">Someone outside SellNest, or prefer not to say</option>
              {buyers.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Final price (৳, optional)" hint="Only used for your own records">
          {(p) => <Input {...p} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />}
        </Field>
        {mutation.error && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}
        <Button type="submit" className="w-full" loading={mutation.isPending}>
          Mark as sold
        </Button>
      </form>
    </Dialog>
  );
}

function ListingRow({ listing, onChange }: { listing: MyListing; onChange: () => void }) {
  const [soldOpen, setSoldOpen] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const status = useMutation({
    mutationFn: (action: 'pause' | 'reactivate' | 'archive') => api(`/listings/${listing.id}/status`, { body: { action } }),
    onSuccess: () => {
      setConfirm(null);
      onChange();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api(`/listings/${listing.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      setConfirm(null);
      onChange();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const s = listing.status;
  const viewable = ['ACTIVE', 'PAUSED', 'SOLD', 'PENDING_REVIEW', 'REJECTED'].includes(s);
  const editable = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'REJECTED'].includes(s);
  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 sm:flex-row">
      <ListingImage image={listing.cover} alt="" sizes="96px" className="h-18 w-24 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {viewable ? (
            <Link href={listing.path} className="truncate font-semibold hover:underline">
              {listing.title}
            </Link>
          ) : (
            <span className="truncate font-semibold">{listing.title || 'Untitled draft'}</span>
          )}
          <Badge tone={s === 'ACTIVE' ? 'good' : s === 'REJECTED' ? 'danger' : s === 'PENDING_REVIEW' ? 'warn' : 'neutral'}>{STATUS_LABELS[s]}</Badge>
        </div>
        <p className="tabular">{listing.priceBdt ? formatBdt(listing.priceBdt) : 'No price yet'}</p>
        {s !== 'DRAFT' ? (
          <p className="tabular text-sm text-muted">
            {listing.viewCount} views, {listing.favoriteCount} saves, {listing.conversationCount} chats, {listing.openOfferCount} open offers
          </p>
        ) : (
          <p className="text-sm text-muted">Edited {timeAgo(listing.updatedAt)}</p>
        )}
        {listing.rejectionReason && s === 'REJECTED' && <p className="mt-1 text-sm text-danger">Rejected: {listing.rejectionReason}</p>}
        <div className="-ml-3 mt-1 flex flex-wrap">
          {editable && (
            <Link href={`/sell/${listing.id}`} className={buttonClass('ghost', 'sm')}>
              {s === 'DRAFT' ? 'Continue' : s === 'REJECTED' ? 'Fix and resubmit' : 'Edit'}
            </Link>
          )}
          {(s === 'ACTIVE' || s === 'PAUSED') && (
            <Button variant="ghost" size="sm" onClick={() => setSoldOpen(true)}>
              Mark as sold
            </Button>
          )}
          {s === 'ACTIVE' && (
            <Button variant="ghost" size="sm" onClick={() => status.mutate('pause')}>
              Pause
            </Button>
          )}
          {s === 'PAUSED' && (
            <Button variant="ghost" size="sm" onClick={() => status.mutate('reactivate')}>
              Reactivate
            </Button>
          )}
          {s !== 'ARCHIVED' && s !== 'DRAFT' && (
            <Button variant="ghost" size="sm" onClick={() => setConfirm('archive')}>
              Archive
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm('delete')}>
            Delete
          </Button>
        </div>
      </div>
      <MarkSoldDialog listing={listing} open={soldOpen} onOpenChange={setSoldOpen} onDone={onChange} />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive this listing?"
        description="It disappears from public pages and stays in your records. An archived listing cannot be published again."
        confirmLabel="Archive"
        loading={status.isPending}
        onConfirm={() => status.mutate('archive')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this listing?"
        description="You will not be able to get it back."
        confirmLabel="Delete"
        danger
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </li>
  );
}

export function MyListings({ drafts }: { drafts?: boolean }) {
  const client = useQueryClient();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const key = ['my-listings', drafts ? 'DRAFT' : status, page];
  const { data, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<Paginated<MyListing>>(`/me/listings${toQuery({ status: drafts ? 'DRAFT' : status, page, limit: 20 })}`),
  });
  // The drafts tab owns drafts, so "all" leaves them out to keep the two lists distinct.
  const items = drafts || status ? data?.items : data?.items.filter((l) => l.status !== 'DRAFT');
  return (
    <section>
      {!drafts && (
        <label className="mb-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Show</span>
          <Select
            className="h-9 w-auto py-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {(['ACTIVE', 'PENDING_REVIEW', 'PAUSED', 'SOLD', 'REJECTED', 'ARCHIVED'] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </label>
      )}
      {isPending && <p className="text-muted">Loading listings</p>}
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {items && items.length === 0 && (
        <EmptyState
          title={drafts ? 'No drafts' : status ? 'Nothing here' : 'You have not listed anything yet'}
          action={
            <Link href="/sell" className={buttonClass('primary')}>
              Sell an item
            </Link>
          }
        />
      )}
      <ul>{items?.map((l) => <ListingRow key={l.id} listing={l} onChange={() => void client.invalidateQueries({ queryKey: ['my-listings'] })} />)}</ul>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="tabular text-sm text-muted">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}

export function Favorites() {
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['favorites', page],
    queryFn: () => api<Paginated<ListingCard>>(`/me/favorites?page=${page}&limit=24`),
  });
  if (isPending) return <p className="text-muted">Loading saved listings</p>;
  if (error) return <Notice tone="danger">{errorMessage(error)}</Notice>;
  if (!data.items.length) {
    return (
      <EmptyState
        title="Nothing saved yet"
        action={
          <Link href="/explore" className={buttonClass('primary')}>
            Explore listings
          </Link>
        }
      >
        Tap the heart on a listing to keep it here.
      </EmptyState>
    );
  }
  return (
    <>
      <ListingGrid listings={data.items} />
      {data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}

const OFFER_LABELS: Record<OfferStatus, string> = {
  PENDING: 'Waiting for seller',
  COUNTERED: 'Waiting for buyer',
  ACCEPTED: 'Accepted',
  REJECTED: 'Declined',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

function OfferRow({ offer, role }: { offer: OfferDetail; role: 'buyer' | 'seller' }) {
  const client = useQueryClient();
  const [counterOpen, setCounterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const act = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: unknown }) => api(`/offers/${offer.id}/${action}`, { method: 'POST', body }),
    onSuccess: () => {
      setCounterOpen(false);
      setAmount('');
      void client.invalidateQueries({ queryKey: ['offers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const myTurn = (offer.status === 'PENDING' && role === 'seller') || (offer.status === 'COUNTERED' && role === 'buyer');
  const canCancel = ['ACCEPTED'].includes(offer.status) || (role === 'buyer' && ['PENDING', 'COUNTERED'].includes(offer.status)) || (role === 'seller' && offer.status === 'COUNTERED');
  const other = role === 'buyer' ? offer.seller : offer.buyer;
  const value = Number(amount);
  return (
    <li className="flex gap-3 border-b border-line py-3">
      <ListingImage image={offer.listing.cover} alt="" sizes="72px" className="size-16 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <Link href={offer.listing.path} className="block truncate font-semibold hover:underline">
          {offer.listing.title}
        </Link>
        <p className="tabular">
          <strong>{formatBdt(offer.amountBdt)}</strong> <span className="text-muted">asking {formatBdt(offer.listing.priceBdt)}</span>
        </p>
        <p className="text-sm text-muted">
          {role === 'buyer' ? 'Seller' : 'Buyer'}: {other.displayName}, {timeAgo(offer.updatedAt)}
        </p>
        <div className="mt-1">
          <Badge tone={offer.status === 'ACCEPTED' ? 'good' : myTurn ? 'warn' : 'neutral'}>{myTurn ? 'Your turn' : OFFER_LABELS[offer.status]}</Badge>
        </div>
        {offer.note && <p className="mt-1 break-words text-sm">{offer.note}</p>}
        {offer.status === 'ACCEPTED' && (
          <p className="mt-1 text-sm text-muted">
            Agreed, but not sold yet. Arrange the handover in your messages.{role === 'seller' ? ' Mark it as sold once it has changed hands.' : ''}
          </p>
        )}
        <div className="-ml-3 mt-1 flex flex-wrap">
          {myTurn && (
            <>
              <Button variant="ghost" size="sm" loading={act.isPending} onClick={() => act.mutate({ action: 'accept' })}>
                Accept
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCounterOpen(true)}>
                Counter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => act.mutate({ action: 'reject' })}>
                Decline
              </Button>
            </>
          )}
          {canCancel && (
            <Button variant="ghost" size="sm" onClick={() => act.mutate({ action: 'cancel' })}>
              {offer.status === 'ACCEPTED' ? 'Back out' : 'Cancel'}
            </Button>
          )}
          {offer.conversationId && (
            <Link href={`/inbox/${offer.conversationId}`} className={buttonClass('ghost', 'sm')}>
              Message
            </Link>
          )}
          <Button variant="ghost" size="sm" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
            History
          </Button>
        </div>
        {historyOpen && (
          <ol className="mt-1 text-sm text-muted">
            {offer.events.map((e) => (
              <li key={e.id} className="tabular">
                {e.type.charAt(0) + e.type.slice(1).toLowerCase().replace(/_/g, ' ')}
                {e.amountBdt ? ` at ${formatBdt(e.amountBdt)}` : ''}, {timeAgo(e.createdAt)}
              </li>
            ))}
          </ol>
        )}
      </div>
      <Dialog open={counterOpen} onOpenChange={setCounterOpen} title="Make a counter offer">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (value >= 1) act.mutate({ action: 'counter', body: { amountBdt: value } });
          }}
        >
          <Field label="Your price (৳)">{(p) => <Input {...p} inputMode="numeric" autoFocus value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />}</Field>
          <Button type="submit" className="w-full" disabled={!(value >= 1)} loading={act.isPending}>
            Send counter offer
          </Button>
        </form>
      </Dialog>
    </li>
  );
}

export function Offers() {
  const [role, setRole] = useState<'buyer' | 'seller'>('seller');
  const { data, error, isPending } = useQuery({
    queryKey: ['offers', role],
    queryFn: () => api<Paginated<OfferDetail>>(`/offers?role=${role}&limit=48`),
  });
  return (
    <section>
      <div className="mb-2 flex gap-1" role="group" aria-label="Offer type">
        {(['seller', 'buyer'] as const).map((r) => (
          <Button key={r} size="sm" variant={role === r ? 'primary' : 'outline'} aria-pressed={role === r} onClick={() => setRole(r)}>
            {r === 'seller' ? 'Offers you received' : 'Offers you made'}
          </Button>
        ))}
      </div>
      {isPending && <p className="text-muted">Loading offers</p>}
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {data && !data.items.length && (
        <EmptyState title={role === 'seller' ? 'No offers received' : 'No offers made'}>
          {role === 'seller' ? 'Offers on your listings appear here.' : 'Make an offer from a listing that is open to offers.'}
        </EmptyState>
      )}
      <ul>{data?.items.map((o) => <OfferRow key={o.id} offer={o} role={role} />)}</ul>
    </section>
  );
}

export function PendingReviews() {
  const me = useMe();
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pending-reviews'],
    enabled: Boolean(me),
    queryFn: () => api<{ listingId: string; path: string; title: string; sellerName: string }[]>('/me/pending-reviews'),
  });
  const [open, setOpen] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const submit = useMutation({
    mutationFn: () => api('/reviews', { body: { listingId: open, rating, comment: comment.trim() || undefined } }),
    onSuccess: () => {
      toast.success('Review published');
      setOpen(null);
      setComment('');
      void client.invalidateQueries({ queryKey: ['pending-reviews'] });
    },
  });
  if (!data?.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-lg font-semibold">Review your purchases</h2>
      <ul>
        {data.map((r) => (
          <li key={r.listingId} className="flex items-center justify-between gap-3 border-b border-line py-2">
            <span className="min-w-0 truncate">
              <Link className="font-medium hover:underline" href={r.path}>
                {r.title}
              </Link>{' '}
              <span className="text-muted">from {r.sellerName}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setOpen(r.listingId)}>
              Write a review
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)} title="Write a review">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <Field label="Rating">
            {(p) => (
              <Select {...p} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} of 5
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="What was it like? (optional)">{(p) => <Textarea {...p} rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
          {submit.error && <Notice tone="danger">{errorMessage(submit.error)}</Notice>}
          <Button type="submit" className="w-full" loading={submit.isPending}>
            Publish review
          </Button>
        </form>
      </Dialog>
    </section>
  );
}
