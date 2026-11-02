import type { Metadata } from 'next';
import { Reports } from '@/components/admin';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return <Reports />;
}
