import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { InboxFrame } from '@/components/inbox-frame';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Messages' };

export default async function InboxLayout({ children }: { children: ReactNode }) {
  await requireUser('/inbox');
  return <InboxFrame>{children}</InboxFrame>;
}
