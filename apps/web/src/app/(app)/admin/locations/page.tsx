import type { Metadata } from 'next';
import { Locations } from '@/components/admin';

export const metadata: Metadata = { title: 'Locations' };

export default function Page() {
  return <Locations />;
}
