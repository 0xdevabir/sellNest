import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-md px-4 py-10">{children}</main>;
}
