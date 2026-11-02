'use client';

import {
  CONDITION_LABELS,
  LISTING_CONDITIONS,
  LISTING_SORTS,
  SORT_LABELS,
  type ListingCondition,
  type ListingSort,
} from '@sellnest/shared';
import { SlidersHorizontal } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useCatalog } from './providers';
import { Button, Dialog, Field, Input, Select } from './ui';

/** All filter state lives in the URL, so results can be shared and survive reloads. */
function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else if (value) next.set(key, value);
    }
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return { params, update, pending };
}

function Filters({ onDone }: { onDone?: () => void }) {
  const { params, update } = useFilterUrl();
  const { categories, locations, config, place } = useCatalog();
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');
  useEffect(() => {
    setMin(params.get('minPrice') ?? '');
    setMax(params.get('maxPrice') ?? '');
  }, [params]);

  const category = params.get('category') ?? '';
  const parent = categories.find((c) => c.slug === category || c.children.some((s) => s.slug === category));
  const location = params.get('location') ?? place.slug ?? 'all';
  const conditions = params.getAll('condition');
  const set = (changes: Parameters<typeof update>[0]) => update(changes);

  return (
    <div className="space-y-5">
      <Field label="Category">
        {(p) => (
          <Select {...p} value={parent?.slug ?? ''} onChange={(e) => set({ category: e.target.value || null })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {parent && parent.children.length > 0 && (
        <Field label="Subcategory">
          {(p) => (
            <Select {...p} value={category === parent.slug ? '' : category} onChange={(e) => set({ category: e.target.value || parent.slug })}>
              <option value="">All in {parent.name}</option>
              {parent.children.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Location">
        {(p) => (
          <Select {...p} value={location} onChange={(e) => set({ location: e.target.value })}>
            <option value="all">All of Bangladesh</option>
            {locations
              .filter((l) => !['COUNTRY', 'DIVISION', 'DISTRICT'].includes(l.type))
              .map((l) => (
                <option key={l.id} value={l.slug}>
                  {l.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      {location !== 'all' && (
        <Field label="Distance">
          {(p) => (
            <Select {...p} value={params.get('radiusKm') ?? String(place.radiusKm)} onChange={(e) => set({ radiusKm: e.target.value })}>
              {config.radiiKm.map((r) => (
                <option key={r} value={r}>
                  Within {r} km
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          set({ minPrice: min || null, maxPrice: max || null });
          onDone?.();
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lowest price (৳)">
            {(p) => <Input {...p} inputMode="numeric" pattern="[0-9]*" value={min} onChange={(e) => setMin(e.target.value)} />}
          </Field>
          <Field label="Highest price (৳)">
            {(p) => <Input {...p} inputMode="numeric" pattern="[0-9]*" value={max} onChange={(e) => setMax(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" variant="outline" size="sm" className="mt-2 w-full">
          Apply price
        </Button>
      </form>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Condition</legend>
        {LISTING_CONDITIONS.map((c: ListingCondition) => (
          <label key={c} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              className="size-4 accent-ink"
              checked={conditions.includes(c)}
              onChange={(e) => set({ condition: e.target.checked ? [...conditions, c] : conditions.filter((v) => v !== c) })}
            />
            {CONDITION_LABELS[c]}
          </label>
        ))}
      </fieldset>
      <Field label="Availability">
        {(p) => (
          <Select {...p} value={params.get('availability') ?? 'available'} onChange={(e) => set({ availability: e.target.value })}>
            <option value="available">Available now</option>
            <option value="sold">Sold</option>
            <option value="all">Available and sold</option>
          </Select>
        )}
      </Field>
    </div>
  );
}

export function SortSelect() {
  const { params, update } = useFilterUrl();
  const hasQuery = Boolean(params.get('q'));
  const options = LISTING_SORTS.filter((s) => s !== 'relevance' || hasQuery);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sort by</span>
      <Select
        className="h-9 w-auto py-1"
        value={params.get('sort') ?? (hasQuery ? 'relevance' : 'nearest')}
        onChange={(e) => update({ sort: e.target.value })}
      >
        {options.map((s: ListingSort) => (
          <option key={s} value={s}>
            {SORT_LABELS[s]}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ResetFilters() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={() => router.push('/explore')}>
      Reset filters
    </Button>
  );
}

export function DesktopFilters() {
  return (
    <aside aria-label="Filters" className="hidden w-60 shrink-0 lg:block">
      <Filters />
    </aside>
  );
}

export function MobileFilters() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Filters">
        <Filters onDone={() => setOpen(false)} />
        <Button className="mt-5 w-full" onClick={() => setOpen(false)}>
          Show results
        </Button>
      </Dialog>
    </div>
  );
}
