import Link from 'next/link';
import { buttonClass } from '@/components/ui-core';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold tracking-tight">This page does not exist</h1>
      <p className="mt-2 text-muted">The listing may have been sold or removed, or the link may be wrong.</p>
      <Link href="/explore" className={buttonClass('primary', 'md', 'mt-5')}>
        Explore listings
      </Link>
    </main>
  );
}
