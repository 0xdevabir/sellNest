import { Thread } from '@/components/inbox';

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Thread key={id} id={id} />;
}
