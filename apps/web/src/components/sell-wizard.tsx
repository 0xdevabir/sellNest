'use client';

import {
  CONDITION_LABELS,
  formatBdt,
  IMAGE_ACCEPTED_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MIN_DIMENSION,
  LISTING_CONDITIONS,
  type ImageVariants,
  type ListingCondition,
  type ListingDraftInput,
  type ListingEditable,
  type ListingStatus,
  type NearbyLocation,
} from '@sellnest/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, ImagePlus, LocateFixed, RotateCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError, errorMessage, toApiError, toQuery } from '@/lib/api';
import { ListingImage } from './listing-tile';
import { useCatalog } from './providers';
import { Button, cx, Field, Input, Notice, Select, Textarea } from './ui';

export function StartListingButton() {
  const router = useRouter();
  const start = useMutation({
    mutationFn: () => api<{ id: string }>('/listings', { method: 'POST' }),
    onSuccess: (l) => router.push(`/sell/${l.id}`),
  });
  return (
    <div className="mt-5">
      <Button size="lg" onClick={() => start.mutate()} loading={start.isPending}>
        Start a new listing
      </Button>
      {start.error && (
        <div className="mt-3">
          <Notice tone="danger">{errorMessage(start.error)}</Notice>
        </div>
      )}
    </div>
  );
}

/** Scales large photos down in the browser so uploads stay quick on mobile data. */
export async function compressImage(file: File, maxEdge = 2400): Promise<File> {
  if (file.type === 'image/gif') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // The server decides whether it can read this file.
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
}

/** XHR because fetch cannot report upload progress. */
function uploadImage(file: File, onProgress: (percent: number) => void) {
  return new Promise<ImageVariants>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/uploads/images');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'The upload failed. Check your connection and try again.'));
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText) as ImageVariants);
      else reject(await toApiError(new Response(xhr.responseText, { status: xhr.status })));
    };
    const body = new FormData();
    body.append('file', file);
    xhr.send(body);
  });
}

interface PendingUpload {
  key: string;
  file: File;
  name: string;
  percent: number;
  error: string | null;
}

function checkFile(file: File): string | null {
  if (!(IMAGE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return `${file.name} is not a JPEG, PNG or WebP photo.`;
  return null;
}

function PhotosStep({
  images,
  onChange,
  max,
  uploadsEnabled,
}: {
  images: ImageVariants[];
  onChange: (update: (current: ImageVariants[]) => ImageVariants[]) => void;
  max: number;
  uploadsEnabled: boolean;
}) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const patch = (key: string, change: Partial<PendingUpload>) => setPending((all) => all.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const run = async (item: PendingUpload) => {
    patch(item.key, { error: null, percent: 0 });
    try {
      const compressed = await compressImage(item.file);
      if (compressed.size > IMAGE_MAX_BYTES) throw new Error(`${item.name} is over ${Math.round(IMAGE_MAX_BYTES / 1_000_000)} MB.`);
      const image = await uploadImage(compressed, (percent) => patch(item.key, { percent }));
      onChange((current) => [...current, image]);
      setPending((all) => all.filter((p) => p.key !== item.key));
    } catch (e) {
      patch(item.key, { error: errorMessage(e) });
    }
  };

  const addFiles = (files: File[]) => {
    setProblem(null);
    const room = max - images.length - pending.length;
    if (files.length > room) setProblem(`You can add up to ${max} photos, so only the first ${Math.max(room, 0)} were added.`);
    const accepted: PendingUpload[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const bad = checkFile(file);
      if (bad) setProblem(bad);
      else accepted.push({ key: crypto.randomUUID(), file, name: file.name, percent: 0, error: null });
    }
    setPending((all) => [...all, ...accepted]);
    accepted.forEach((item) => void run(item));
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    onChange((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold">Add photos</h2>
      <p className="mb-3 text-muted">
        Up to {max} photos, at least {IMAGE_MIN_DIMENSION}px wide. The first one is the cover. Drag to reorder.
      </p>
      {!uploadsEnabled && <Notice tone="warn">Photo uploads are not set up on this server yet.</Notice>}
      <div
        onDragOver={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDragOver(false);
          addFiles([...e.dataTransfer.files]);
        }}
        className={cx('mt-2 rounded-md border-2 border-dashed p-6 text-center', dragOver ? 'border-ink bg-accent-soft' : 'border-line-strong')}
      >
        <input
          ref={input}
          type="file"
          multiple
          accept={IMAGE_ACCEPTED_TYPES.join(',')}
          className="sr-only"
          aria-label="Choose photos"
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        <Button variant="outline" disabled={!uploadsEnabled || images.length + pending.length >= max} onClick={() => input.current?.click()}>
          <ImagePlus className="size-5" aria-hidden />
          Choose photos
        </Button>
        <p className="mt-2 hidden text-sm text-muted md:block">or drop them here</p>
      </div>
      {problem && (
        <div className="mt-3">
          <Notice tone="danger">{problem}</Notice>
        </div>
      )}
      {pending.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Uploads in progress">
          {pending.map((p) => (
            <li key={p.key} className="rounded-md border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                {p.error ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => void run(p)}>
                      <RotateCw className="size-4" aria-hidden />
                      Retry
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}>
                      Remove
                    </Button>
                  </>
                ) : (
                  <span className="tabular text-sm text-muted">{p.percent}%</span>
                )}
              </div>
              {p.error ? (
                <p role="alert" className="mt-1 text-sm text-danger">
                  {p.error}
                </p>
              ) : (
                <div role="progressbar" aria-label={`Uploading ${p.name}`} aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} className="mt-1.5 h-1 rounded bg-line">
                  <div className="h-1 rounded bg-ink" style={{ width: `${p.percent}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, i) => (
            <li
              key={image.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => dragIndex !== null && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              className={cx('cursor-grab', dragIndex === i && 'opacity-50')}
            >
              <div className="relative">
                <ListingImage image={image} alt={`Photo ${i + 1}`} sizes="240px" className="aspect-[4/3] w-full rounded-md" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-xs text-white">Cover</span>}
              </div>
              <div className="mt-1 flex justify-between">
                <span>
                  <Button variant="ghost" size="icon" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={`Move photo ${i + 1} later`} disabled={i === images.length - 1} onClick={() => move(i, i + 1)}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                </span>
                <Button variant="ghost" size="icon" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange((current) => current.filter((x) => x.id !== image.id))}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Draft = {
  title: string;
  description: string;
  categoryId: string;
  condition: ListingCondition | '';
  brand: string;
  model: string;
  price: string;
  originalPrice: string;
  negotiable: boolean;
  locationId: string;
  meetupAvailable: boolean;
  deliveryAvailable: boolean;
};

const STEPS = ['Photos', 'Details', 'Location', 'Preview'] as const;

function toDraft(l: ListingEditable): Draft {
  return {
    title: l.title ?? '',
    description: l.description ?? '',
    categoryId: l.categoryId ?? '',
    condition: l.condition ?? '',
    brand: l.brand ?? '',
    model: l.model ?? '',
    price: l.priceBdt?.toString() ?? '',
    originalPrice: l.originalPriceBdt?.toString() ?? '',
    negotiable: l.negotiable,
    locationId: l.locationId ?? '',
    meetupAvailable: l.meetupAvailable,
    deliveryAvailable: l.deliveryAvailable,
  };
}

function toPayload(d: Draft, images: ImageVariants[]): ListingDraftInput {
  const money = (v: string) => (/^[1-9]\d*$/.test(v) ? Number(v) : null);
  return {
    title: d.title.trim() || null,
    description: d.description.trim() || null,
    categoryId: d.categoryId || null,
    condition: d.condition || null,
    brand: d.brand.trim() || null,
    model: d.model.trim() || null,
    priceBdt: money(d.price),
    originalPriceBdt: money(d.originalPrice),
    negotiable: d.negotiable,
    locationId: d.locationId || null,
    meetupAvailable: d.meetupAvailable,
    deliveryAvailable: d.deliveryAvailable,
    imageIds: images.map((i) => i.id),
  };
}

/** What still stops publishing, by step. Mirrors publishableListingSchema with friendlier wording. */
export function missingFields(d: Draft, imageCount: number) {
  const errors: Partial<Record<keyof Draft | 'images', string>> = {};
  if (imageCount < 1) errors.images = 'Add at least one photo';
  if (d.title.trim().length < 5) errors.title = 'Enter a title of at least 5 characters';
  if (d.description.trim().length < 20) errors.description = 'Describe the item in at least 20 characters';
  if (!d.categoryId) errors.categoryId = 'Choose a category';
  if (!d.condition) errors.condition = 'Choose a condition';
  if (!/^[1-9]\d*$/.test(d.price)) errors.price = 'Enter a price in whole taka';
  if (!d.locationId) errors.locationId = 'Choose an area';
  return errors;
}

export function SellWizard({ listing, emailVerified }: { listing: ListingEditable; emailVerified: boolean }) {
  const router = useRouter();
  const { categories, locations, config } = useCatalog();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => toDraft(listing));
  const [images, setImages] = useState(listing.images);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [showErrors, setShowErrors] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const latest = useRef({ draft, images });
  latest.current = { draft, images };
  const firstRender = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);

  const isDraft = listing.status === 'DRAFT';
  const errors = missingFields(draft, images.length);
  const stepOfError: Record<string, number> = { images: 0, title: 1, description: 1, categoryId: 1, condition: 1, price: 1, locationId: 2 };

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      await api(`/listings/${listing.id}`, { method: 'PATCH', body: toPayload(latest.current.draft, latest.current.images) });
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      return false;
    }
  }, [listing.id]);

  // Published listings could change publicly mid-edit, so only drafts autosave.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState('dirty');
    if (!isDraft) return;
    const timer = setTimeout(() => void save(), 1200);
    return () => clearTimeout(timer);
  }, [draft, images, isDraft, save]);

  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const go = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
    setTimeout(() => heading.current?.focus(), 0);
  };

  const useMyLocation = () => {
    setLocateError(null);
    if (!navigator.geolocation) {
      setLocateError('This browser cannot share your location. Choose an area from the list.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const nearby = await api<NearbyLocation[]>(`/locations/nearby${toQuery({ lat: coords.latitude, lng: coords.longitude })}`);
          if (nearby[0]) {
            set('locationId', nearby[0].id);
            toast.success(`Set to ${nearby[0].name}`);
          } else setLocateError('No listed area is near you yet. Choose the closest one from the list.');
        } catch (e) {
          setLocateError(errorMessage(e));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocateError('Location access is off or unavailable. Choose an area from the list.');
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const publish = useMutation({
    mutationFn: async () => {
      setPublishError(null);
      if (!(await save())) throw new Error('Your changes could not be saved. Check your connection and try again.');
      return api<{ status: ListingStatus }>(`/listings/${listing.id}/publish`, { method: 'POST' });
    },
    onSuccess: ({ status }) => {
      setSaveState('saved');
      if (status === 'ACTIVE') {
        toast.success('Published');
        router.push(listing.path);
      } else {
        toast.success('Sent for review');
        router.push('/account');
      }
      router.refresh();
    },
    onError: (e) => setPublishError(errorMessage(e)),
  });

  const saveChanges = useMutation({
    mutationFn: async () => {
      if (!(await save())) throw new Error('Your changes could not be saved. Fix any problems and try again.');
    },
    onSuccess: () => {
      toast.success('Changes saved');
      router.push(listing.path);
      router.refresh();
    },
    onError: (e) => setPublishError(errorMessage(e)),
  });

  const hasErrors = Object.keys(errors).length > 0;
  const tryPublish = (action: () => void) => {
    if (hasErrors) {
      setShowErrors(true);
      go(Math.min(...Object.keys(errors).map((k) => stepOfError[k] ?? 0)));
      return;
    }
    action();
  };
  const show = (key: keyof typeof errors) => (showErrors ? errors[key] : undefined);
  const areas = locations.filter((l) => !['COUNTRY', 'DIVISION', 'DISTRICT'].includes(l.type));
  const chosenCategory = categories.flatMap((c) => [c, ...c.children]).find((c) => c.id === draft.categoryId);
  const chosenArea = locations.find((l) => l.id === draft.locationId);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href={isDraft ? '/sell' : '/account'} className="text-muted underline">
          {isDraft ? 'Your drafts' : 'Your listings'}
        </Link>
        <p className="text-sm text-muted" role="status">
          {isDraft
            ? { saved: 'Draft saved', dirty: 'Unsaved changes', saving: 'Saving', error: 'Could not save. Keep this page open and try again.' }[saveState]
            : saveState === 'saved'
              ? ''
              : 'Unsaved changes'}
        </p>
      </div>
      {listing.rejectionReason && (
        <div className="mb-4">
          <Notice tone="danger">Moderators rejected this listing: {listing.rejectionReason}</Notice>
        </div>
      )}
      <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label="Steps">
        {STEPS.map((name, i) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === step ? 'step' : undefined}
              className={cx('w-full border-t-[3px] pt-1.5 text-left text-sm', i <= step ? 'border-ink font-medium' : 'border-line text-muted')}
            >
              {name}
            </button>
          </li>
        ))}
      </ol>
      <h1 ref={heading} tabIndex={-1} className="sr-only">
        {isDraft ? 'New listing' : 'Edit listing'}: {STEPS[step]}
      </h1>

      {step === 0 && (
        <>
          <PhotosStep images={images} onChange={setImages} max={config.maxListingImages} uploadsEnabled={config.uploadsEnabled} />
          {show('images') && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {show('images')}
            </p>
          )}
        </>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Say what it is</h2>
          <Field label="Title" error={show('title')} hint="What a buyer would search for">
            {(p) => <Input {...p} maxLength={100} value={draft.title} onChange={(e) => set('title', e.target.value)} />}
          </Field>
          <Field label="Category" error={show('categoryId')}>
            {(p) => (
              <Select {...p} value={draft.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">Choose a category</option>
                {categories.map((c) =>
                  c.children.length ? (
                    <optgroup key={c.id} label={c.name}>
                      {c.children.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ),
                )}
              </Select>
            )}
          </Field>
          <Field label="Condition" error={show('condition')}>
            {(p) => (
              <Select {...p} value={draft.condition} onChange={(e) => set('condition', e.target.value as ListingCondition)}>
                <option value="">Choose a condition</option>
                {LISTING_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {CONDITION_LABELS[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Description" error={show('description')} hint="Age, faults, what is included, why you are selling">
            {(p) => <Textarea {...p} rows={6} maxLength={5000} value={draft.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Brand (optional)">{(p) => <Input {...p} maxLength={60} value={draft.brand} onChange={(e) => set('brand', e.target.value)} />}</Field>
            <Field label="Model (optional)">{(p) => <Input {...p} maxLength={60} value={draft.model} onChange={(e) => set('model', e.target.value)} />}</Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (৳)" error={show('price')}>
              {(p) => <Input {...p} inputMode="numeric" value={draft.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} />}
            </Field>
            <Field label="Price when new (৳, optional)">
              {(p) => <Input {...p} inputMode="numeric" value={draft.originalPrice} onChange={(e) => set('originalPrice', e.target.value.replace(/\D/g, ''))} />}
            </Field>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-ink" checked={draft.negotiable} onChange={(e) => set('negotiable', e.target.checked)} />
            Open to offers
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Where is the handover?</h2>
          <p className="text-muted">Buyers see this area, never your exact address. Pick a place you are happy to meet near.</p>
          <Button variant="outline" onClick={useMyLocation} loading={locating}>
            <LocateFixed className="size-4" aria-hidden />
            Use my location
          </Button>
          {locateError && <Notice tone="warn">{locateError}</Notice>}
          <Field label="Area" error={show('locationId')}>
            {(p) => (
              <Select {...p} value={draft.locationId} onChange={(e) => set('locationId', e.target.value)}>
                <option value="">Choose an area</option>
                {areas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.parentName ? `, ${l.parentName}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">How can the buyer get it?</legend>
            <label className="flex items-center gap-2 py-1">
              <input type="checkbox" className="size-4 accent-ink" checked={draft.meetupAvailable} onChange={(e) => set('meetupAvailable', e.target.checked)} />
              Meet in person
            </label>
            <label className="flex items-center gap-2 py-1">
              <input type="checkbox" className="size-4 accent-ink" checked={draft.deliveryAvailable} onChange={(e) => set('deliveryAvailable', e.target.checked)} />
              I can deliver it myself
            </label>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="mb-3 text-xl font-semibold">Check it over</h2>
          {images[0] && <ListingImage image={images[0]} alt="Cover photo" sizes="640px" className="aspect-[4/3] w-full rounded-md" />}
          <h3 className="mt-3 text-2xl font-bold leading-tight">{draft.title || 'No title yet'}</h3>
          <p className="tabular mt-1 text-2xl font-bold">{/^[1-9]\d*$/.test(draft.price) ? formatBdt(Number(draft.price)) : 'No price yet'}</p>
          <p className="text-muted">
            {[draft.condition && CONDITION_LABELS[draft.condition], chosenCategory?.name, chosenArea?.name].filter(Boolean).join(', ')}
          </p>
          <p className="mt-3 whitespace-pre-line break-words">{draft.description || 'No description yet'}</p>
          {hasErrors ? (
            <div className="mt-4">
              <Notice tone="warn">
                Before you can publish:
                <ul className="mt-1 list-disc pl-5">
                  {Object.entries(errors).map(([key, message]) => (
                    <li key={key}>
                      <button type="button" className="underline" onClick={() => go(stepOfError[key] ?? 0)}>
                        {message}
                      </button>
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-1.5 font-medium">
              <Check className="size-4" aria-hidden />
              Ready to publish
            </p>
          )}
          {!emailVerified && isDraft && (
            <div className="mt-3">
              <Notice tone="warn">
                Verify your email to publish.{' '}
                <Link className="underline" href="/account/settings">
                  Send a new link
                </Link>
              </Notice>
            </div>
          )}
          {publishError && (
            <div className="mt-3">
              <Notice tone="danger">{publishError}</Notice>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">
            By publishing you confirm this is not a{' '}
            <Link className="underline" href="/prohibited-items">
              prohibited item
            </Link>
            . New accounts may wait for a moderator before their listing appears.
          </p>
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 border-t border-line pt-4">
        {step > 0 && (
          <Button variant="outline" onClick={() => go(step - 1)}>
            Back
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          {isDraft && (
            <Button variant="ghost" onClick={() => void save()} disabled={saveState === 'saved' || saveState === 'saving'}>
              Save draft
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => go(step + 1)}>Continue</Button>
          ) : isDraft || listing.status === 'REJECTED' ? (
            <Button loading={publish.isPending} disabled={!emailVerified} onClick={() => tryPublish(() => publish.mutate())}>
              Publish
            </Button>
          ) : (
            <Button loading={saveChanges.isPending} onClick={() => tryPublish(() => saveChanges.mutate())}>
              Save changes
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
