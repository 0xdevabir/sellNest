'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, updateProfileSchema, type ImageVariants, type Me, type PublicUserSummary } from '@sellnest/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { useCatalog } from './providers';
import { Avatar, Button, Field, Input, Notice, Select, Textarea } from './ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-6 first:pt-0">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type ProfileValues = {
  displayName?: string;
  username?: string;
  bio?: string | null;
  locationId?: string | null;
  defaultRadiusKm?: number;
  showSoldListings?: boolean;
};

function ProfileForm({ me }: { me: Me }) {
  const router = useRouter();
  const client = useQueryClient();
  const { locations, config } = useCatalog();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema.pick({ displayName: true, username: true, bio: true, locationId: true, defaultRadiusKm: true, showSoldListings: true })),
    defaultValues: {
      displayName: me.displayName,
      username: me.username,
      bio: me.bio ?? '',
      locationId: me.location?.id ?? null,
      defaultRadiusKm: me.defaultRadiusKm,
      showSoldListings: me.showSoldListings,
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/me', { method: 'PATCH', body: { ...values, bio: values.bio?.trim() || null } });
      toast.success('Profile saved');
      form.reset(values);
      void client.invalidateQueries({ queryKey: ['me'] });
      router.refresh();
    } catch (e) {
      setError(applyServerErrors(e, form.setError, ['displayName', 'username', 'bio', 'locationId']));
    }
  });
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <Field label="Your name" error={errors.displayName?.message}>
        {(p) => <Input {...p} {...form.register('displayName')} autoComplete="name" />}
      </Field>
      <Field label="Username" error={errors.username?.message}>
        {(p) => <Input {...p} {...form.register('username')} autoComplete="username" />}
      </Field>
      <Field label="About you" error={errors.bio?.message}>
        {(p) => <Textarea {...p} {...form.register('bio')} rows={3} />}
      </Field>
      <Field label="Your usual area">
        {(p) => (
          <Select {...p} {...form.register('locationId', { setValueAs: (v) => v || null })}>
            <option value="">None</option>
            {locations
              .filter((l) => !['COUNTRY', 'DIVISION', 'DISTRICT'].includes(l.type))
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Usual search distance">
        {(p) => (
          <Select {...p} {...form.register('defaultRadiusKm', { valueAsNumber: true })}>
            {config.radiiKm.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </Select>
        )}
      </Field>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="size-4 accent-ink" {...form.register('showSoldListings')} />
        Show my sold items on my public profile
      </label>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" disabled={!isDirty} loading={isSubmitting}>
        Save profile
      </Button>
    </form>
  );
}

function AvatarForm({ me }: { me: Me }) {
  const router = useRouter();
  const { config } = useCatalog();
  const input = useRef<HTMLInputElement>(null);
  const mutation = useMutation({
    mutationFn: async (imageId: File | null) => {
      if (!imageId) return api('/me', { method: 'PATCH', body: { avatarImageId: null } });
      const body = new FormData();
      body.append('file', imageId);
      const res = await fetch('/api/v1/uploads/images', { method: 'POST', body });
      if (!res.ok) throw new Error('That photo could not be uploaded. Use a JPEG, PNG or WebP under 10 MB.');
      const image = (await res.json()) as ImageVariants;
      return api('/me', { method: 'PATCH', body: { avatarImageId: image.id } });
    },
    onSuccess: () => {
      toast.success('Photo updated');
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="flex items-center gap-3">
      <Avatar name={me.displayName} url={me.avatarUrl} size={64} />
      {config.uploadsEnabled ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Choose a profile photo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) mutation.mutate(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" loading={mutation.isPending} onClick={() => input.current?.click()}>
            Change photo
          </Button>
          {me.avatarUrl && (
            <Button variant="ghost" size="sm" onClick={() => mutation.mutate(null)}>
              Remove
            </Button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Photo uploads are not set up on this server yet.</p>
      )}
    </div>
  );
}

function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ currentPassword: string; newPassword: string }>({ resolver: zodResolver(changePasswordSchema) });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/change-password', { body: values });
      toast.success('Password changed');
      form.reset({ currentPassword: '', newPassword: '' });
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <Field label="Current password" error={errors.currentPassword?.message}>
        {(p) => <Input {...p} {...form.register('currentPassword')} type="password" autoComplete="current-password" />}
      </Field>
      <Field label="New password" error={errors.newPassword?.message} hint="At least 10 characters">
        {(p) => <Input {...p} {...form.register('newPassword')} type="password" autoComplete="new-password" />}
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" loading={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}

function Blocks() {
  const client = useQueryClient();
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: () => api<PublicUserSummary[]>('/me/blocks') });
  const unblock = useMutation({
    mutationFn: (id: string) => api(`/users/${id}/block`, { method: 'DELETE' }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['blocks'] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data?.length) return <p className="text-muted">You have not blocked anyone.</p>;
  return (
    <ul className="max-w-md">
      {data.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-3 border-b border-line py-2">
          <span className="truncate">{u.displayName}</span>
          <Button variant="outline" size="sm" onClick={() => unblock.mutate(u.id)}>
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function Settings({ me }: { me: Me }) {
  const resend = useMutation({
    mutationFn: () => api('/auth/resend-verification', { method: 'POST' }),
    onSuccess: () => toast.success('Verification link sent'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const signOut = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => window.location.assign('/'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div>
      <Section title="Email">
        <p>{me.email}</p>
        {me.emailVerified ? (
          <p className="text-sm text-muted">Verified</p>
        ) : (
          <div className="mt-2 max-w-md space-y-2">
            <Notice tone="warn">Verify your email to publish listings, send messages and make offers.</Notice>
            <Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
              Send verification link
            </Button>
          </div>
        )}
      </Section>
      <Section title="Profile photo">
        <AvatarForm me={me} />
      </Section>
      <Section title="Profile">
        <ProfileForm me={me} />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
      <Section title="Blocked people">
        <Blocks />
      </Section>
      <section className="py-6">
        <Button variant="outline" loading={signOut.isPending} onClick={() => signOut.mutate()}>
          Sign out
        </Button>
      </section>
    </div>
  );
}
