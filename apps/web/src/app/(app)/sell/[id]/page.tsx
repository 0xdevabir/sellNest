import type { ListingEditable } from '@sellnest/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SellWizard } from '@/components/sell-wizard';
import { ApiError } from '@/lib/api';
import { requireUser, serverApi } from '@/lib/server';

export const metadata: Metadata = { title: 'Edit listing' };

export default async function SellDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/sell/${id}`);
  let listing: ListingEditable;
  try {
    listing = await serverApi<ListingEditable>(`/listings/${id}/edit`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 400)) notFound();
    throw e;
  }
  return <SellWizard listing={listing} emailVerified={me.emailVerified} />;
}
