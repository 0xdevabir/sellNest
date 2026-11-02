'use client';

import type { PublicProfile } from '@sellnest/shared';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useMe } from './providers';
import { ReportDialog } from './report-dialog';
import { Button, buttonClass, ConfirmDialog } from './ui';

export function ProfileActions({ profile }: { profile: PublicProfile }) {
  const me = useMe();
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const block = useMutation({
    mutationFn: () => api(`/users/${profile.id}/block`, { method: profile.viewerHasBlocked ? 'DELETE' : 'POST' }),
    onSuccess: () => {
      toast.success(profile.viewerHasBlocked ? `Unblocked ${profile.displayName}` : `Blocked ${profile.displayName}`);
      setBlockOpen(false);
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (me?.id === profile.id) {
    return (
      <Link href="/account/settings" className={buttonClass('outline')}>
        Edit profile
      </Link>
    );
  }
  if (!me) return null;
  return (
    <div className="flex gap-1">
      <Button variant="ghost" onClick={() => setReportOpen(true)}>
        Report
      </Button>
      <Button variant="ghost" onClick={() => (profile.viewerHasBlocked ? block.mutate() : setBlockOpen(true))} loading={block.isPending}>
        {profile.viewerHasBlocked ? 'Unblock' : 'Block'}
      </Button>
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} targetType="USER" targetId={profile.id} title={`Report ${profile.displayName}`} />
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={`Block ${profile.displayName}?`}
        description="You will not be able to message each other. You can unblock them later in Settings."
        confirmLabel="Block"
        danger
        onConfirm={() => block.mutate()}
        loading={block.isPending}
      />
    </div>
  );
}
