'use client';

import { formatBdt, STATUS_LABELS, timeAgo, type ChatMessage, type ConversationSummary } from '@sellnest/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { ListingImage } from './listing-tile';
import { useMe } from './providers';
import { ReportDialog } from './report-dialog';
import { Avatar, Badge, Button, buttonClass, ConfirmDialog, cx, EmptyState, Notice, Textarea } from './ui';

export function ConversationList() {
  const pathname = usePathname();
  const me = useMe();
  const { data, error, isPending } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<{ items: ConversationSummary[] }>('/conversations?limit=48'),
  });
  if (isPending) return <p className="p-4 text-muted">Loading conversations</p>;
  if (error) return <div className="p-4"><Notice tone="danger">{errorMessage(error)}</Notice></div>;
  if (!data.items.length) {
    return (
      <div className="p-4">
        <EmptyState
          title="No messages yet"
          action={
            <Link href="/explore" className={buttonClass('primary')}>
              Explore listings
            </Link>
          }
        >
          Message a seller from any listing and the conversation appears here.
        </EmptyState>
      </div>
    );
  }
  return (
    <ul>
      {data.items.map((c) => {
        const href = `/inbox/${c.id}`;
        return (
          <li key={c.id} className="border-b border-line">
            <Link href={href} aria-current={pathname === href ? 'page' : undefined} className={cx('flex gap-3 p-3 hover:bg-accent-soft', pathname === href && 'bg-accent-soft')}>
              <ListingImage image={c.listing.cover} alt="" sizes="56px" className="size-14 shrink-0 rounded" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cx('truncate', c.unreadCount > 0 ? 'font-bold' : 'font-medium')}>{c.other.displayName}</span>
                  {c.lastMessage && <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(c.lastMessage.createdAt)}</span>}
                </span>
                <span className="block truncate text-sm text-muted">{c.listing.title}</span>
                <span className="flex items-center gap-2">
                  <span className={cx('min-w-0 flex-1 truncate text-sm', c.unreadCount > 0 && 'font-semibold')}>
                    {c.lastMessage ? `${c.lastMessage.senderId === me?.id ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet'}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="tabular shrink-0 rounded-full bg-ink px-1.5 text-xs text-white">
                      <span className="sr-only">Unread: </span>
                      {c.unreadCount}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
}
function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
}

export function Thread({ id }: { id: string }) {
  const me = useMe();
  const router = useRouter();
  const client = useQueryClient();
  const [body, setBody] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const conversation = useQuery({ queryKey: ['conversation', id], queryFn: () => api<ConversationSummary>(`/conversations/${id}`) });
  const thread = useInfiniteQuery({
    queryKey: ['thread', id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<{ items: ChatMessage[]; hasMore: boolean }>(`/conversations/${id}/messages?limit=50${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    getNextPageParam: (last) => (last.hasMore ? last.items[last.items.length - 1]?.createdAt : undefined),
  });

  const messages = (thread.data?.pages ?? []).flatMap((p) => p.items).slice().reverse();
  const newest = messages[messages.length - 1]?.id;
  const unread = conversation.data?.unreadCount ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [newest]);

  // Mark as read whenever a new message lands while this thread is open.
  useEffect(() => {
    if (!newest) return;
    void api(`/conversations/${id}/read`, { method: 'POST' })
      .then(() => {
        void client.invalidateQueries({ queryKey: ['conversations'] });
        void client.invalidateQueries({ queryKey: ['me'] });
        if (unread > 0) void client.invalidateQueries({ queryKey: ['conversation', id] });
        router.refresh();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, newest, unread]);

  const send = useMutation({
    mutationFn: (text: string) => api<ChatMessage>(`/conversations/${id}/messages`, { body: { body: text } }),
    onMutate: () => setFailed(null),
    onSuccess: () => {
      setBody('');
      void client.invalidateQueries({ queryKey: ['thread', id] });
      void client.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (e) => setFailed(errorMessage(e)),
  });

  const c = conversation.data;
  const block = useMutation({
    mutationFn: () => api(`/users/${c!.other.id}/block`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(`Blocked ${c!.other.displayName}`);
      setBlockOpen(false);
      void client.invalidateQueries({ queryKey: ['conversation', id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (conversation.error) {
    return (
      <div className="p-4">
        <Notice tone="danger">{errorMessage(conversation.error)}</Notice>
      </div>
    );
  }
  if (!c) return <p className="p-4 text-muted">Loading conversation</p>;

  const submit = () => {
    const text = body.trim();
    if (text && !send.isPending) send.mutate(text);
  };
  const lastMine = [...messages].reverse().find((m) => m.senderId === me?.id);
  const seen = Boolean(lastMine && c.otherLastReadAt && new Date(c.otherLastReadAt) >= new Date(lastMine.createdAt));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-line p-2.5">
        <Link href="/inbox" className={buttonClass('ghost', 'sm', 'md:hidden')}>
          Back
        </Link>
        <Link href={`/u/${c.other.username}`} className="flex min-w-0 items-center gap-2 hover:underline">
          <Avatar name={c.other.displayName} url={c.other.avatarUrl} />
          <span className="truncate font-semibold">{c.other.displayName}</span>
        </Link>
        <div className="ml-auto flex shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
            Report
          </Button>
          {!c.blocked && (
            <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)}>
              Block
            </Button>
          )}
        </div>
      </header>
      <Link href={c.listing.path} className="flex items-center gap-3 border-b border-line bg-surface p-2.5 hover:bg-accent-soft">
        <ListingImage image={c.listing.cover} alt="" sizes="48px" className="size-11 shrink-0 rounded" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.listing.title}</span>
        {c.listing.status !== 'ACTIVE' && <Badge tone="dark">{STATUS_LABELS[c.listing.status]}</Badge>}
        <span className="tabular shrink-0 font-semibold">{formatBdt(c.listing.priceBdt)}</span>
      </Link>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" aria-label="Messages" aria-live="polite" role="log">
        {thread.hasNextPage && (
          <div className="mb-3 text-center">
            <Button variant="ghost" size="sm" loading={thread.isFetchingNextPage} onClick={() => void thread.fetchNextPage()}>
              Show earlier messages
            </Button>
          </div>
        )}
        {thread.isPending && <p className="text-muted">Loading messages</p>}
        {!thread.isPending && messages.length === 0 && (
          <p className="py-6 text-center text-muted">Say hello and ask about the item. Keep the conversation here until you have decided to meet.</p>
        )}
        {messages.map((m, i) => {
          const previous = messages[i - 1];
          const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(m.createdAt);
          const mine = m.senderId === me?.id;
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center text-xs text-muted">{dayLabel(m.createdAt)}</p>}
              {m.type === 'SYSTEM' ? (
                <p className="my-2 text-center text-sm text-muted">{m.body}</p>
              ) : (
                <div className={cx('my-1 flex', mine && 'justify-end')}>
                  <div className={cx('max-w-[80%] rounded-lg px-3 py-1.5', mine ? 'bg-ink text-white' : 'border border-line bg-surface')}>
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                    <p className={cx('tabular mt-0.5 flex items-center justify-end gap-1 text-xs', mine ? 'text-white/70' : 'text-muted')}>
                      {clock(m.createdAt)}
                      {m.id === lastMine?.id &&
                        (seen ? <CheckCheck className="size-3.5" aria-label="Seen" /> : <Check className="size-3.5" aria-label="Sent" />)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {c.blocked ? (
        <div className="border-t border-line p-3">
          <Notice>You cannot message each other because one of you has blocked the other.</Notice>
        </div>
      ) : (
        <form
          className="border-t border-line p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {failed && (
            <div className="mb-2">
              <Notice tone="danger">{failed}</Notice>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Write a message"
              rows={1}
              maxLength={2000}
              className="max-h-32 min-h-11 resize-none"
              placeholder="Write a message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
              Send
            </Button>
          </div>
        </form>
      )}
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="CONVERSATION" targetId={c.id} title="Report this conversation" />
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Block ${c.other.displayName}?`}
        description="You will not be able to message each other. You can unblock them later in Settings."
        confirmLabel="Block"
        danger
        loading={block.isPending}
        onConfirm={() => block.mutate()}
      />
    </div>
  );
}
