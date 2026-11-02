import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { safeNext } from '@/lib/api';
import { getMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getMe()) redirect(safeNext(next));
  return <LoginForm next={next} />;
}
