import type { Metadata } from 'next';
import { VerifyEmail } from '@/components/auth-forms';

export const metadata: Metadata = { title: 'Verify your email', referrer: 'no-referrer' };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token} />;
}
