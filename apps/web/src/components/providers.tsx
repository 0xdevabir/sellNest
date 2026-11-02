'use client';

import {
  LOCATION_COOKIE,
  type CategoryNode,
  type ChatMessage,
  type LocationNode,
  type Me,
  type NotificationItem,
  type PublicConfig,
} from '@sellnest/shared';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import { toast, Toaster } from 'sonner';
import { api } from '@/lib/api';

export interface Catalog {
  categories: CategoryNode[];
  locations: LocationNode[];
  config: PublicConfig;
}
export interface Place {
  slug: string | null;
  name: string;
  radiusKm: number;
}

const CatalogContext = createContext<Catalog & { place: Place }>(null as never);
export const useCatalog = () => useContext(CatalogContext);

export function useMe(): Me | null {
  const { data } = useQuery<Me | null>({ queryKey: ['me'], staleTime: 30_000, queryFn: () => api<Me>('/auth/me').catch(() => null) });
  return data ?? null;
}

/** Saves the chosen area in a cookie (never coordinates) and re-renders server content for it. */
export function useSetPlace() {
  const router = useRouter();
  return (slug: string, radiusKm: number) => {
    document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(`${slug}|${radiusKm}`)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
}

function Realtime({ signedIn }: { signedIn: boolean }) {
  const client = useQueryClient();

  useEffect(() => {
    if (!signedIn) return;
    const socket = io({ path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('message:new', (m: ChatMessage) => {
      void client.invalidateQueries({ queryKey: ['thread', m.conversationId] });
      void client.invalidateQueries({ queryKey: ['conversations'] });
      void client.invalidateQueries({ queryKey: ['me'] });
    });
    socket.on('conversation:read', (e: { conversationId: string }) => {
      void client.invalidateQueries({ queryKey: ['conversation', e.conversationId] });
      void client.invalidateQueries({ queryKey: ['conversations'] });
      void client.invalidateQueries({ queryKey: ['me'] });
    });
    socket.on('notification:new', (n: NotificationItem) => {
      void client.invalidateQueries({ queryKey: ['me'] });
      void client.invalidateQueries({ queryKey: ['notifications'] });
      void client.invalidateQueries({ queryKey: ['offers'] });
      if (n.type !== 'NEW_MESSAGE') toast(n.title, { description: n.body ?? undefined });
    });
    return () => void socket.disconnect();
  }, [signedIn, client]);

  return null;
}

export function Providers({
  children,
  me,
  catalog,
  place,
}: {
  children: ReactNode;
  me: Me | null;
  catalog: Catalog;
  place: Place;
}) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
    });
    c.setQueryData(['me'], me);
    return c;
  });
  const value = useMemo(() => ({ ...catalog, place }), [catalog, place]);
  return (
    <QueryClientProvider client={client}>
      <CatalogContext.Provider value={value}>
        <Realtime signedIn={Boolean(me)} />
        {children}
        <Toaster position="top-center" toastOptions={{ style: { fontFamily: 'inherit' } }} />
      </CatalogContext.Provider>
    </QueryClientProvider>
  );
}
