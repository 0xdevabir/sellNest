import type { Metadata } from 'next';
import { Moderation } from '@/components/admin';

export const metadata: Metadata = { title: 'Moderation' };

export default function Page() {
  return <Moderation />;
}
