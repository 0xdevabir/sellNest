'use client';

import {
  categoryUpsertSchema,
  formatBdt,
  LISTING_STATUSES,
  LOCATION_TYPES,
  locationUpsertSchema,
  platformSettingsSchema,
  REPORT_REASON_LABELS,
  REPORT_STATUSES,
  slugify,
  STATUS_LABELS,
  timeAgo,
  USER_ROLES,
  USER_STATUSES,
  type AdminListing,
  type AdminOverview,
  type AdminReport,
  type AdminUser,
  type AuditEntry,
  type ListingStatus,
  type Paginated,
  type PlatformSettings,
} from '@sellnest/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { api, errorMessage, toQuery } from '@/lib/api';
import { ListingImage } from './listing-tile';
import { useMe } from './providers';
import { Badge, Button, ConfirmDialog, cx, Dialog, EmptyState, Field, Input, Notice, Select, Textarea } from './ui';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/categories', label: 'Categories', adminOnly: true },
  { href: '/admin/locations', label: 'Locations', adminOnly: true },
  { href: '/admin/settings', label: 'Settings', adminOnly: true },
  { href: '/admin/audit', label: 'Audit log', adminOnly: true },
];

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export function AdminTabs() {
  const pathname = usePathname();
  const me = useMe();
  return (
    <nav aria-label="Admin" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4">
      {TABS.filter((t) => !t.adminOnly || me?.role === 'ADMIN').map((t) => (
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

function Pager({ data, page, onPage }: { data?: { page: number; totalPages: number }; page: number; onPage: (p: number) => void }) {
  if (!data || data.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="tabular text-sm text-muted">
        Page {data.page} of {data.totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

function Loading({ error, pending, label }: { error: unknown; pending: boolean; label: string }) {
  if (error) return <Notice tone="danger">{errorMessage(error)}</Notice>;
  if (pending) return <p className="text-muted">Loading {label}</p>;
  return null;
}

function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Overview() {
  const { data, error, isPending } = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api<AdminOverview>('/admin/overview') });
  if (!data) return <Loading error={error} pending={isPending} label="the overview" />;
  const groups: { title: string; rows: [string, number, string?][] }[] = [
    { title: 'Needs attention', rows: [['Listings waiting for review', data.pendingListings, '/admin/moderation'], ['Open reports', data.openReports, '/admin/reports']] },
    { title: 'People', rows: [['Total', data.totalUsers], ['Joined in the last 7 days', data.newUsers7d], ['Active in the last 7 days', data.activeUsers7d]] },
    { title: 'Listings', rows: [['Total', data.totalListings], ['Live', data.activeListings], ['Sold', data.soldListings], ['New in the last 7 days', data.newListings7d]] },
    { title: 'Last 7 days', rows: [['Messages', data.messages7d], ['Offers', data.offers7d], ['Reports', data.reports7d]] },
  ];
  return (
    <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-1 font-semibold">{g.title}</h2>
          <dl>
            {g.rows.map(([label, value, href]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
                <dt>{href ? <Link className="underline" href={href}>{label}</Link> : label}</dt>
                <dd className="tabular text-lg font-semibold">{value.toLocaleString('en-US')}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function UserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const me = useMe();
  const client = useQueryClient();
  const [status, setStatus] = useState(user.status);
  const [role, setRole] = useState(user.role);
  const [reason, setReason] = useState('');
  const changed = status !== user.status || role !== user.role;
  const save = useMutation({
    mutationFn: () =>
      api(`/admin/users/${user.id}`, {
        method: 'PATCH',
        body: { ...(status !== user.status ? { status } : {}), ...(role !== user.role ? { role } : {}), reason },
      }),
    onSuccess: () => {
      toast.success('User updated');
      void client.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Change ${user.displayName}`} description="The change and your reason are written to the audit log.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Status">
          {(p) => (
            <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as AdminUser['status'])}>
              {USER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {me?.role === 'ADMIN' && (
          <Field label="Role">
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value as AdminUser['role'])}>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Reason">{(p) => <Textarea {...p} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {save.error && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        <Button type="submit" className="w-full" disabled={!changed || reason.trim().length < 3} loading={save.isPending}>
          Save changes
        </Button>
      </form>
    </Dialog>
  );
}

export function Users() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'users', search, status, role, page],
    placeholderData: keepPreviousData,
    queryFn: () => api<Paginated<AdminUser>>(`/admin/users${toQuery({ q: search, status, role, page })}`),
  });
  return (
    <section>
      <FilterBar>
        <Input aria-label="Search people" placeholder="Name, username or email" className="h-9 max-w-xs py-1" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Status" className="h-9 w-auto py-1" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          {USER_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
        <Select aria-label="Role" className="h-9 w-auto py-1" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Any role</option>
          {USER_ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </Select>
      </FilterBar>
      <Loading error={error} pending={isPending} label="people" />
      {data && !data.items.length && <EmptyState title="No one matches">Try a different search or filter.</EmptyState>}
      <ul>
        {data?.items.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2.5">
            <div className="min-w-0 flex-1 basis-60">
              <Link className="font-semibold hover:underline" href={`/u/${u.username}`}>{u.displayName}</Link>
              <p className="truncate text-sm text-muted">{u.email}</p>
              <p className="tabular text-sm text-muted">{u.listingCount} listings, joined {timeAgo(u.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {u.role !== 'USER' && <Badge tone="dark">{titleCase(u.role)}</Badge>}
              {u.status !== 'ACTIVE' && <Badge tone="danger">{titleCase(u.status)}</Badge>}
              {!u.emailVerified && <Badge>Unverified</Badge>}
              {u.id !== me?.id && (
                <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                  Change
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pager data={data} page={page} onPage={setPage} />
      {editing && <UserDialog key={editing.id} user={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ListingRow({ listing, actions }: { listing: AdminListing; actions?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 border-b border-line py-3 sm:flex-row">
      <ListingImage image={listing.cover} alt="" sizes="96px" className="h-18 w-24 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={listing.path} className="font-semibold hover:underline">{listing.title}</Link>
          <Badge>{STATUS_LABELS[listing.status]}</Badge>
          {listing.isDemo && <Badge tone="warn">Demo</Badge>}
        </div>
        <p className="tabular">{listing.priceBdt ? formatBdt(listing.priceBdt) : 'No price'}</p>
        <p className="text-sm text-muted">
          <Link className="underline" href={`/u/${listing.seller.username}`}>{listing.seller.displayName}</Link>, joined {timeAgo(listing.seller.createdAt)}. Listed {timeAgo(listing.createdAt)}.
        </p>
        {listing.flagReason && <p className="mt-1 text-sm text-danger">Flagged: {listing.flagReason}</p>}
        <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm">{listing.description}</p>
        {actions}
      </div>
    </li>
  );
}

function ModerationActions({ listing }: { listing: AdminListing }) {
  const client = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const moderate = useMutation({
    mutationFn: (body: { decision: 'approve' | 'reject'; reason?: string }) => api(`/admin/listings/${listing.id}/moderate`, { body }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === 'approve' ? 'Approved' : 'Rejected');
      setApproveOpen(false);
      setRejectOpen(false);
      void client.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mt-2 flex gap-2">
      {listing.status === 'PENDING_REVIEW' && <Button size="sm" onClick={() => setApproveOpen(true)}>Approve</Button>}
      <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>Reject</Button>
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this listing?"
        description="It goes live straight away and the seller is told."
        confirmLabel="Approve"
        loading={moderate.isPending}
        onConfirm={() => moderate.mutate({ decision: 'approve' })}
      />
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen} title="Reject this listing" description="The seller sees your reason and can fix the listing and resubmit.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            moderate.mutate({ decision: 'reject', reason: reason.trim() });
          }}
        >
          <Field label="Reason">{(p) => <Textarea {...p} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <Button type="submit" variant="danger" className="w-full" disabled={reason.trim().length < 3} loading={moderate.isPending}>
            Reject
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

export function Moderation() {
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'listings', 'PENDING_REVIEW', page],
    queryFn: () => api<Paginated<AdminListing>>(`/admin/listings${toQuery({ status: 'PENDING_REVIEW', page })}`),
  });
  return (
    <section>
      <Loading error={error} pending={isPending} label="the queue" />
      {data && !data.items.length && <EmptyState title="The queue is empty">Listings held for review appear here.</EmptyState>}
      <ul>{data?.items.map((l) => <ListingRow key={l.id} listing={l} actions={<ModerationActions listing={l} />} />)}</ul>
      <Pager data={data} page={page} onPage={setPage} />
    </section>
  );
}

export function Listings() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ListingStatus | ''>('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'listings', search, status, page],
    placeholderData: keepPreviousData,
    queryFn: () => api<Paginated<AdminListing>>(`/admin/listings${toQuery({ q: search, status, page })}`),
  });
  return (
    <section>
      <FilterBar>
        <Input aria-label="Search listings" placeholder="Title" className="h-9 max-w-xs py-1" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Status" className="h-9 w-auto py-1" value={status} onChange={(e) => { setStatus(e.target.value as ListingStatus | ''); setPage(1); }}>
          <option value="">Any status</option>
          {LISTING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </Select>
      </FilterBar>
      <Loading error={error} pending={isPending} label="listings" />
      {data && !data.items.length && <EmptyState title="No listings match">Try a different search or status.</EmptyState>}
      <ul>
        {data?.items.map((l) => (
          <ListingRow key={l.id} listing={l} actions={l.status === 'PENDING_REVIEW' || l.status === 'ACTIVE' ? <ModerationActions listing={l} /> : undefined} />
        ))}
      </ul>
      <Pager data={data} page={page} onPage={setPage} />
    </section>
  );
}

function ResolveDialog({ report, status, onClose }: { report: AdminReport; status: 'RESOLVED' | 'DISMISSED'; onClose: () => void }) {
  const client = useQueryClient();
  const [note, setNote] = useState('');
  const resolve = useMutation({
    mutationFn: () => api(`/admin/reports/${report.id}/resolve`, { body: { status, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success(status === 'RESOLVED' ? 'Report resolved' : 'Report dismissed');
      void client.invalidateQueries({ queryKey: ['admin'] });
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={status === 'RESOLVED' ? 'Resolve this report' : 'Dismiss this report'}
      description="This closes the report. It does not change the listing or the account, so do that first if needed."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          resolve.mutate();
        }}
      >
        <Field label="Note for the audit log (optional)">{(p) => <Textarea {...p} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        {resolve.error && <Notice tone="danger">{errorMessage(resolve.error)}</Notice>}
        <Button type="submit" className="w-full" loading={resolve.isPending}>
          {status === 'RESOLVED' ? 'Resolve report' : 'Dismiss report'}
        </Button>
      </form>
    </Dialog>
  );
}

export function Reports() {
  const [status, setStatus] = useState<string>('OPEN');
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<{ report: AdminReport; status: 'RESOLVED' | 'DISMISSED' } | null>(null);
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'reports', status, page],
    queryFn: () => api<Paginated<AdminReport>>(`/admin/reports${toQuery({ status, page })}`),
  });
  return (
    <section>
      <FilterBar>
        <Select aria-label="Status" className="h-9 w-auto py-1" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Any status</option>
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
        </Select>
      </FilterBar>
      <Loading error={error} pending={isPending} label="reports" />
      {data && !data.items.length && <EmptyState title="No reports here">Reports from people using SellNest appear here.</EmptyState>}
      <ul>
        {data?.items.map((r) => (
          <li key={r.id} className="border-b border-line py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{REPORT_REASON_LABELS[r.reason]}</span>
              <Badge>{titleCase(r.targetType)}</Badge>
              {r.status !== 'OPEN' && <Badge tone="good">{titleCase(r.status)}</Badge>}
            </div>
            <p className="text-sm">
              {r.target.href ? <Link className="underline" href={r.target.href}>{r.target.label}</Link> : r.target.label}
            </p>
            {r.target.excerpt && <p className="mt-1 break-words border-l-2 border-line pl-2 text-sm text-muted">{r.target.excerpt}</p>}
            {r.details && <p className="mt-1 break-words text-sm">{r.details}</p>}
            <p className="text-sm text-muted">Reported by {r.reporter?.username ?? 'a deleted account'}, {timeAgo(r.createdAt)}</p>
            {r.note && <p className="text-sm text-muted">Note: {r.note}</p>}
            {r.status === 'OPEN' && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setClosing({ report: r, status: 'RESOLVED' })}>Resolve</Button>
                <Button size="sm" variant="outline" onClick={() => setClosing({ report: r, status: 'DISMISSED' })}>Dismiss</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <Pager data={data} page={page} onPage={setPage} />
      {closing && <ResolveDialog key={closing.report.id} {...closing} onClose={() => setClosing(null)} />}
    </section>
  );
}

type RawCategory = { id: string; name: string; slug: string; parentId: string | null; icon: string | null; sortOrder: number; isActive: boolean };
type RawLocation = { id: string; name: string; slug: string; type: (typeof LOCATION_TYPES)[number]; parentId: string | null; latitude: number; longitude: number; isFeatured: boolean; isActive: boolean };

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((i) => `${String(i.path[0] ?? 'Form')}: ${i.message}`).join('. ');
}

function CategoryDialog({ value, parents, onClose }: { value: RawCategory | null; parents: RawCategory[]; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(value?.name ?? '');
  const [slug, setSlug] = useState(value?.slug ?? '');
  const [parentId, setParentId] = useState(value?.parentId ?? '');
  const [sortOrder, setSortOrder] = useState(String(value?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(value?.isActive ?? true);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: unknown) => api(value ? `/admin/categories/${value.id}` : '/admin/categories', { method: value ? 'PUT' : 'POST', body }),
    onSuccess: () => {
      toast.success('Category saved');
      void client.invalidateQueries({ queryKey: ['admin', 'categories'] });
      onClose();
    },
    onError: (e) => setProblem(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={value ? 'Edit category' : 'Add a category'}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          const parsed = categoryUpsertSchema.safeParse({ name, slug: slug || slugify(name), parentId: parentId || null, icon: value?.icon ?? null, sortOrder: Number(sortOrder), isActive });
          if (!parsed.success) return setProblem(fieldErrors(parsed.error.issues));
          save.mutate(parsed.data);
        }}
      >
        <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Web address name" hint="Left empty, it is made from the name. Changing it breaks existing links.">
          {(p) => <Input {...p} value={slug} onChange={(e) => setSlug(e.target.value)} />}
        </Field>
        <Field label="Parent">
          {(p) => (
            <Select {...p} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">None, this is a top-level category</option>
              {parents.filter((c) => c.id !== value?.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Position">{(p) => <Input {...p} inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ''))} />}</Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-ink" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Show to people on SellNest
        </label>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Button type="submit" className="w-full" loading={save.isPending}>Save category</Button>
      </form>
    </Dialog>
  );
}

export function Categories() {
  const [editing, setEditing] = useState<RawCategory | null | 'new'>(null);
  const { data, error, isPending } = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api<RawCategory[]>('/admin/categories') });
  if (!data) return <Loading error={error} pending={isPending} label="categories" />;
  const tops = data.filter((c) => !c.parentId);
  const row = (c: RawCategory, child?: boolean) => (
    <li key={c.id} className={cx('flex items-center gap-3 border-b border-line py-2', child && 'pl-5')}>
      <span className={cx('min-w-0 flex-1 truncate', !child && 'font-semibold')}>{c.name}</span>
      {!c.isActive && <Badge>Hidden</Badge>}
      <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Edit</Button>
    </li>
  );
  return (
    <section className="max-w-2xl">
      <Button className="mb-3" variant="outline" size="sm" onClick={() => setEditing('new')}>Add a category</Button>
      <ul>{tops.flatMap((t) => [row(t), ...data.filter((c) => c.parentId === t.id).map((c) => row(c, true))])}</ul>
      {editing && <CategoryDialog key={editing === 'new' ? 'new' : editing.id} value={editing === 'new' ? null : editing} parents={tops} onClose={() => setEditing(null)} />}
    </section>
  );
}

function LocationDialog({ value, all, onClose }: { value: RawLocation | null; all: RawLocation[]; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(value?.name ?? '');
  const [slug, setSlug] = useState(value?.slug ?? '');
  const [type, setType] = useState<RawLocation['type']>(value?.type ?? 'AREA');
  const [parentId, setParentId] = useState(value?.parentId ?? '');
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  const [isFeatured, setIsFeatured] = useState(value?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(value?.isActive ?? true);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: unknown) => api(value ? `/admin/locations/${value.id}` : '/admin/locations', { method: value ? 'PUT' : 'POST', body }),
    onSuccess: () => {
      toast.success('Location saved');
      void client.invalidateQueries({ queryKey: ['admin', 'locations'] });
      onClose();
    },
    onError: (e) => setProblem(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={value ? 'Edit location' : 'Add a location'} description="Use the centre of a public area, never a home address.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setProblem(null);
          const parsed = locationUpsertSchema.safeParse({
            name,
            slug: slug || slugify(name),
            type,
            parentId: parentId || null,
            latitude: latitude === '' ? NaN : Number(latitude),
            longitude: longitude === '' ? NaN : Number(longitude),
            isFeatured,
            isActive,
          });
          if (!parsed.success) return setProblem(fieldErrors(parsed.error.issues));
          save.mutate(parsed.data);
        }}
      >
        <Field label="Name">{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Web address name" hint="Left empty, it is made from the name. Changing it breaks existing links.">
          {(p) => <Input {...p} value={slug} onChange={(e) => setSlug(e.target.value)} />}
        </Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as RawLocation['type'])}>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Inside">
          {(p) => (
            <Select {...p} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Nothing</option>
              {all.filter((l) => l.id !== value?.id).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">{(p) => <Input {...p} inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />}</Field>
          <Field label="Longitude">{(p) => <Input {...p} inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />}</Field>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-ink" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Suggest this first in the location picker
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-ink" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Show to people on SellNest
        </label>
        {problem && <Notice tone="danger">{problem}</Notice>}
        <Button type="submit" className="w-full" loading={save.isPending}>Save location</Button>
      </form>
    </Dialog>
  );
}

export function Locations() {
  const [editing, setEditing] = useState<RawLocation | null | 'new'>(null);
  const [q, setQ] = useState('');
  const { data, error, isPending } = useQuery({ queryKey: ['admin', 'locations'], queryFn: () => api<RawLocation[]>('/admin/locations') });
  if (!data) return <Loading error={error} pending={isPending} label="locations" />;
  const shown = data.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="max-w-2xl">
      <FilterBar>
        <Input aria-label="Filter locations" placeholder="Filter by name" className="h-9 max-w-xs py-1" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => setEditing('new')}>Add a location</Button>
      </FilterBar>
      <ul>
        {shown.map((l) => (
          <li key={l.id} className="flex items-center gap-3 border-b border-line py-2">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{l.name}</span> <span className="text-sm text-muted">{titleCase(l.type)}</span>
            </span>
            {l.isFeatured && <Badge tone="good">Suggested</Badge>}
            {!l.isActive && <Badge>Hidden</Badge>}
            <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button>
          </li>
        ))}
      </ul>
      {editing && <LocationDialog key={editing === 'new' ? 'new' : editing.id} value={editing === 'new' ? null : editing} all={data} onClose={() => setEditing(null)} />}
    </section>
  );
}

function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const client = useQueryClient();
  const [maxImages, setMaxImages] = useState(String(initial.maxListingImages));
  const [daily, setDaily] = useState(String(initial.dailyPublishLimit));
  const [reviewDays, setReviewDays] = useState(String(initial.newAccountReviewDays));
  const [keywords, setKeywords] = useState(initial.prohibitedKeywords.join('\n'));
  const [radii, setRadii] = useState(initial.radiiKm.join(', '));
  const [defaultRadius, setDefaultRadius] = useState(String(initial.defaultRadiusKm));
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<PlatformSettings | null>(null);
  const save = useMutation({
    mutationFn: (body: PlatformSettings) => api('/admin/settings', { method: 'PUT', body }),
    onSuccess: () => {
      toast.success('Settings saved');
      setPending(null);
      void client.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (e) => {
      setPending(null);
      setProblem(errorMessage(e));
    },
  });
  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setProblem(null);
        const radiiKm = radii.split(',').map((r) => Number(r.trim())).filter(Boolean);
        const parsed = platformSettingsSchema.safeParse({
          maxListingImages: Number(maxImages),
          dailyPublishLimit: Number(daily),
          newAccountReviewDays: Number(reviewDays),
          prohibitedKeywords: keywords.split('\n').map((k) => k.trim()).filter(Boolean),
          radiiKm,
          defaultRadiusKm: Number(defaultRadius),
        });
        if (!parsed.success) return setProblem(fieldErrors(parsed.error.issues));
        if (!radiiKm.includes(parsed.data.defaultRadiusKm)) return setProblem('The usual search distance must be one of the distance choices.');
        setPending(parsed.data);
      }}
    >
      <Field label="Photos allowed per listing">{(p) => <Input {...p} inputMode="numeric" value={maxImages} onChange={(e) => setMaxImages(e.target.value)} />}</Field>
      <Field label="Listings one person can publish per day">{(p) => <Input {...p} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} />}</Field>
      <Field label="Days a new account's listings are held for review" hint="0 turns this off">
        {(p) => <Input {...p} inputMode="numeric" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} />}
      </Field>
      <Field label="Distance choices in km" hint="Separate with commas">{(p) => <Input {...p} value={radii} onChange={(e) => setRadii(e.target.value)} />}</Field>
      <Field label="Usual search distance in km">{(p) => <Input {...p} inputMode="numeric" value={defaultRadius} onChange={(e) => setDefaultRadius(e.target.value)} />}</Field>
      <Field label="Words that hold a listing for review" hint="One on each line">
        {(p) => <Textarea {...p} rows={8} value={keywords} onChange={(e) => setKeywords(e.target.value)} />}
      </Field>
      {problem && <Notice tone="danger">{problem}</Notice>}
      <Button type="submit">Save settings</Button>
      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(null)}
        title="Save these settings?"
        description="They apply to everyone straight away and the change is written to the audit log."
        confirmLabel="Save settings"
        loading={save.isPending}
        onConfirm={() => pending && save.mutate(pending)}
      />
    </form>
  );
}

export function PlatformSettingsPanel() {
  const { data, error, isPending } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<PlatformSettings>('/admin/settings') });
  if (!data) return <Loading error={error} pending={isPending} label="settings" />;
  return <SettingsForm initial={data} />;
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'audit', page],
    placeholderData: keepPreviousData,
    queryFn: () => api<Paginated<AuditEntry>>(`/admin/audit?page=${page}`),
  });
  return (
    <section>
      <Loading error={error} pending={isPending} label="the audit log" />
      {data && !data.items.length && <EmptyState title="Nothing logged yet">Staff actions appear here.</EmptyState>}
      <ul>
        {data?.items.map((a) => (
          <li key={a.id} className="border-b border-line py-2">
            <p>
              <span className="font-medium">{a.actor?.username ?? 'System'}</span> {a.action.replace(/[._]/g, ' ').toLowerCase()}
            </p>
            <p className="break-all text-sm text-muted">
              {a.entityType} {a.entityId}, {timeAgo(a.createdAt)}
            </p>
            {a.metadata != null && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted">{JSON.stringify(a.metadata)}</pre>}
          </li>
        ))}
      </ul>
      <Pager data={data} page={page} onPage={setPage} />
    </section>
  );
}
