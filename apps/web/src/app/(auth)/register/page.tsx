import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth-forms';
import { safeNext } from '@/lib/api';
import { getMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Create your account' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getMe()) redirect(safeNext(next));
  return <RegisterForm next={next} />;
}
