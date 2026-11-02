import type { Metadata } from 'next';
import { Favorites } from '@/components/account';

export const metadata: Metadata = { title: 'Saved listings' };

export default function FavoritesPage() {
  return <Favorites />;
}
