'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ConversationList } from './inbox';
import { cx } from './ui';

/** Two panes on desktop; on mobile, the list or the open thread fills the screen. */
export function InboxFrame({ children }: { children: ReactNode }) {
  const inThread = usePathname() !== '/inbox';
  return (
    <main className="mx-auto flex h-[calc(100dvh-7.5rem)] max-w-7xl md:h-[calc(100dvh-4rem)] md:px-4 md:py-4">
      <h1 className="sr-only">Messages</h1>
      <div className={cx('w-full overflow-y-auto bg-surface md:block md:w-80 md:shrink-0 md:rounded-l-md md:border md:border-line', inThread && 'hidden')}>
        <ConversationList />
      </div>
      <div className={cx('min-w-0 flex-1 bg-paper md:block md:rounded-r-md md:border md:border-l-0 md:border-line', !inThread && 'hidden')}>{children}</div>
    </main>
  );
}
