import type { Metadata } from 'next';
import { WelcomeForm } from '@/components/auth-forms';
import { requireUser } from '@/lib/server';

export const metadata: Metadata = { title: 'Set up your profile' };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const me = await requireUser('/welcome');
  return <WelcomeForm me={me} next={next} />;
}
