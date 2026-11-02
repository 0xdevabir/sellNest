import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminTabs } from '@/components/admin';
import { requireStaff } from '@/lib/server';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | SellNest admin' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff('/admin');
  return (
    <main className="mx-auto max-w-5xl px-4 pt-7">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Admin</h1>
      <AdminTabs />
      {children}
    </main>
  );
}
