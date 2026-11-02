import type { Metadata } from 'next';
import { NotificationCenter } from '@/components/notification-center';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await requireUser('/notifications');
  return <NotificationCenter />;
}
