import type { Metadata } from 'next';
import { MyListings } from '@/components/account';

export const metadata: Metadata = { title: 'Drafts' };

export default function DraftsPage() {
  return <MyListings drafts />;
}
