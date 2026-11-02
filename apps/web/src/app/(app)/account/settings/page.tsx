import type { Metadata } from 'next';
import { Settings } from '@/components/account-settings';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const me = await requireUser('/account/settings');
  return <Settings me={me} />;
}
