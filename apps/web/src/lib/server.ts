import 'server-only';
import {
  LOCATION_COOKIE,
  type CategoryNode,
  type LocationNode,
  type Me,
  type PublicConfig,
} from '@sellnest/shared';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { ApiError, toApiError } from './api';

const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4100';

/** Server Component API call. Forwards the visitor's cookie and address, so limits apply per person. */
export async function serverApi<T>(path: string): Promise<T> {
  const [jar, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded = incoming.get('x-forwarded-for');
  let res: Response;
  try {
    res = await fetch(`${API}/api/v1${path}`, {
      cache: 'no-store',
      headers: { cookie: jar.toString(), ...(forwarded ? { 'x-forwarded-for': forwarded } : {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'The SellNest service cannot be reached right now.');
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

/** Catalog data rarely changes and is shared by everyone, so a short cache is safe. */
async function publicApi<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}/api/v1${path}`, { next: { revalidate: 60 } });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const getMe = cache(async (): Promise<Me | null> => {
  try {
    return await serverApi<Me>('/auth/me');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
    throw e;
  }
});

export const getCatalog = cache(async () => {
  const [categories, locations, config] = await Promise.all([
    publicApi<CategoryNode[]>('/categories', []),
    publicApi<LocationNode[]>('/locations', []),
    publicApi<PublicConfig>('/config', {
      radiiKm: [3, 5, 10, 25],
      defaultRadiusKm: 5,
      defaultLocationSlug: null,
      maxListingImages: 8,
      uploadsEnabled: false,
    }),
  ]);
  return { categories, locations, config };
});

export interface CurrentPlace {
  slug: string | null;
  name: string;
  radiusKm: number;
}

/** The visitor's chosen area and radius, falling back to the featured location. */
export const getPlace = cache(async (): Promise<CurrentPlace> => {
  const [jar, { locations, config }] = await Promise.all([cookies(), getCatalog()]);
  const [slug, radius] = decodeURIComponent(jar.get(LOCATION_COOKIE)?.value ?? '').split('|');
  const location =
    locations.find((l) => l.slug === slug) ?? locations.find((l) => l.slug === config.defaultLocationSlug) ?? null;
  const parsed = Number(radius);
  return {
    slug: location?.slug ?? null,
    name: location?.name ?? 'Bangladesh',
    radiusKm: config.radiiKm.includes(parsed) ? parsed : config.defaultRadiusKm,
  };
});

/** Guards a private page, sending visitors to sign in and back again afterwards. */
export async function requireUser(next: string): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(next)}`);
  return me;
}

export async function requireStaff(next: string): Promise<Me> {
  const me = await requireUser(next);
  if (me.role === 'USER') redirect('/');
  return me;
}
