import type { Metadata } from 'next';
import { Users } from '@/components/admin';

export const metadata: Metadata = { title: 'Users' };

export default function Page() {
  return <Users />;
}
