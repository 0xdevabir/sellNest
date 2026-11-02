import type { Metadata } from 'next';
import { Offers } from '@/components/account';

export const metadata: Metadata = { title: 'Offers' };

export default function OffersPage() {
  return <Offers />;
}
