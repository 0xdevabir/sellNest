import type { Metadata } from 'next';
import { PlatformSettingsPanel } from '@/components/admin';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <PlatformSettingsPanel />;
}
