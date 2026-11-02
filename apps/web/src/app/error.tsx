'use client';

import { Button } from '@/components/ui';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">This page could not load</h1>
      <p className="mt-2 text-muted">SellNest could not reach its server. Check your connection and try again.</p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
