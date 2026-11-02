import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountTabs } from '@/components/account';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: { default: 'Your account', template: '%s | SellNest' } };

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const me = await requireUser('/account');
  return (
    <main className="mx-auto max-w-5xl px-4 pt-7">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4">
        <h1 className="text-2xl font-bold tracking-tight">{me.displayName}</h1>
        <div className="flex gap-4">
          <Link className="underline" href={`/u/${me.username}`}>
            View public profile
          </Link>
          {me.role !== 'USER' && (
            <Link className="underline" href="/admin">
              Admin
            </Link>
          )}
        </div>
      </div>
      <AccountTabs />
      {children}
    </main>
  );
}
