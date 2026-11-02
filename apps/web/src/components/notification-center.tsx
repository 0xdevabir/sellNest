'use client';

import { timeAgo, type NotificationItem, type Paginated } from '@sellnest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Button, cx, EmptyState, Notice } from './ui';

export function NotificationCenter() {
  const client = useQueryClient();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => api<Paginated<NotificationItem>>(`/notifications?page=${page}&limit=30`),
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['notifications'] });
    void client.invalidateQueries({ queryKey: ['me'] });
    router.refresh();
  };
  const markAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: refresh });
  const hasUnread = data?.items.some((n) => !n.readAt);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        {hasUnread && (
          <Button variant="outline" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        )}
      </div>
      {isPending && <p className="text-muted">Loading notifications</p>}
      {error && <Notice tone="danger">{errorMessage(error)}</Notice>}
      {data && !data.items.length && <EmptyState title="Nothing new">Offers, messages and listing updates appear here.</EmptyState>}
      <ul>
        {data?.items.map((n) => {
          const content = (
            <>
              <span className={cx('block', n.readAt ? 'font-medium' : 'font-bold')}>
                {!n.readAt && <span className="sr-only">Unread: </span>}
                {n.title}
              </span>
              {n.body && <span className="block break-words text-sm">{n.body}</span>}
              <span className="block text-sm text-muted">{timeAgo(n.createdAt)}</span>
            </>
          );
          return (
            <li key={n.id} className={cx('border-b border-line', !n.readAt && 'bg-accent-soft')}>
              {n.href ? (
                <Link href={n.href} className="block p-3 hover:underline" onClick={() => !n.readAt && markOne.mutate(n.id)}>
                  {content}
                </Link>
              ) : (
                <button type="button" className="block w-full p-3 text-left" onClick={() => !n.readAt && markOne.mutate(n.id)}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Newer
          </Button>
          <span className="tabular text-sm text-muted">
            Page {data.page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Older
          </Button>
        </div>
      )}
    </main>
  );
}
