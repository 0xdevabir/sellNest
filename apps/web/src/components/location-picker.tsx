'use client';

import type { NearbyLocation } from '@sellnest/shared';
import { Crosshair } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, errorMessage, toQuery } from '@/lib/api';
import { useCatalog, useSetPlace } from './providers';
import { Button, cx, Dialog, Input, Notice } from './ui';

/** Dialog for choosing an area and radius. Device location is requested only on a button press. */
export function LocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { locations, config, place } = useCatalog();
  const setPlace = useSetPlace();
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(place.radiusKm);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = locations.filter((l) => !['COUNTRY', 'DIVISION', 'DISTRICT'].includes(l.type));
    return q
      ? list.filter((l) => l.name.toLowerCase().includes(q) || l.parentName?.toLowerCase().includes(q))
      : list;
  }, [locations, query]);

  const choose = (slug: string) => {
    setPlace(slug, radius);
    onOpenChange(false);
  };

  const useDevice = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('This browser cannot share your location. Choose an area from the list.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          // Used once to find the nearest named area. It is not stored anywhere.
          const near = await api<NearbyLocation[]>(`/locations/nearby${toQuery({ lat: coords.latitude, lng: coords.longitude })}`);
          if (near[0]) choose(near[0].slug);
          else setGeoError('No SellNest areas are near you yet. Choose one from the list.');
        } catch (e) {
          setGeoError(errorMessage(e));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setGeoError('Location access was not allowed. Choose an area from the list.');
      },
      { maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose where to look">
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-sm font-medium">Distance</legend>
        <div className="flex flex-wrap gap-1.5">
          {config.radiiKm.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={radius === r}
              onClick={() => {
                setRadius(r);
                if (place.slug) setPlace(place.slug, r);
              }}
              className={cx(
                'tabular h-9 rounded-md border px-3 text-sm',
                radius === r ? 'border-ink bg-ink text-white' : 'border-line-strong hover:bg-accent-soft',
              )}
            >
              {r} km
            </button>
          ))}
        </div>
      </fieldset>
      <Button variant="outline" className="mb-3 w-full" loading={locating} onClick={useDevice}>
        {!locating && <Crosshair className="size-4" aria-hidden />}
        Use my location
      </Button>
      {geoError && (
        <div className="mb-3">
          <Notice tone="warn">{geoError}</Notice>
        </div>
      )}
      <Input
        type="search"
        aria-label="Search areas"
        placeholder="Search for an area or campus"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="mt-2 max-h-64 overflow-y-auto">
        {results.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => choose(l.slug)}
              className={cx(
                'flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-accent-soft',
                l.slug === place.slug && 'font-semibold',
              )}
            >
              <span>{l.name}</span>
              {l.parentName && <span className="text-sm font-normal text-muted">{l.parentName}</span>}
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-2 py-3 text-muted">No areas match that search.</li>}
      </ul>
    </Dialog>
  );
}
