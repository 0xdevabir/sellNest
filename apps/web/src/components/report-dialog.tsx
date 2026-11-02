'use client';

import { REPORT_REASON_LABELS, REPORT_REASONS, type ReportReason, type ReportTarget } from '@sellnest/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { Button, Dialog, Field, Notice, Select, Textarea } from './ui';

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTarget;
  targetId: string;
  title: string;
}) {
  const [reason, setReason] = useState<ReportReason>('FRAUD');
  const [details, setDetails] = useState('');
  const mutation = useMutation({
    mutationFn: () => api('/reports', { body: { targetType, targetId, reason, details: details.trim() || undefined } }),
    onSuccess: () => {
      toast.success('Report sent to the moderators');
      onOpenChange(false);
      setDetails('');
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description="Moderators review every report. The other person is not told who reported them.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="What is wrong?">
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASON_LABELS[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Details (optional)">
          {(p) => <Textarea {...p} rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}
        </Field>
        {mutation.error && <Notice tone="danger">{errorMessage(mutation.error)}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Send report
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
