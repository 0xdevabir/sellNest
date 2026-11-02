'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema,
  loginSchema,
  passwordField,
  registerSchema,
  updateProfileSchema,
  type LoginInput,
  type Me,
  type RegisterInput,
} from '@sellnest/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, errorMessage, safeNext } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { useCatalog } from './providers';
import { Button, buttonClass, Field, Input, Notice, Select, Textarea } from './ui';

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const me = await api<Me>('/auth/login', { body: values });
      const target = safeNext(next);
      // A full navigation so every server-rendered page sees the new session.
      window.location.assign(me.profileCompleted ? target : `/welcome?next=${encodeURIComponent(target)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" autoFocus />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(p) => <Input {...p} {...form.register('password')} type="password" autoComplete="current-password" />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="mt-4">
        <Link className="underline" href="/forgot-password">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2">
        New here?{' '}
        <Link className="font-medium underline" href={`/register${query}`}>
          Create an account
        </Link>
      </p>
    </>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/register', { body: values });
      setSentTo(values.email);
    } catch (e) {
      setError(applyServerErrors(e, form.setError, ['email', 'password', 'displayName']));
    }
  });
  const query = next ? `?next=${encodeURIComponent(next)}` : '';
  if (sentTo) {
    return (
      <>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Check your email</h1>
        <p>
          If <strong>{sentTo}</strong> can be registered, a verification link is on its way. Open it, then sign in.
        </p>
        <Link href={`/login${query}`} className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
          Go to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Your name" error={errors.displayName?.message}>
          {(p) => <Input {...p} {...form.register('displayName')} autoComplete="name" autoFocus />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" />}
        </Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters">
          {(p) => <Input {...p} {...form.register('password')} type="password" autoComplete="new-password" />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-3 text-sm text-muted">
        By creating an account you agree to the{' '}
        <Link className="underline" href="/terms">
          terms
        </Link>{' '}
        and{' '}
        <Link className="underline" href="/privacy">
          privacy notice
        </Link>
        .
      </p>
      <p className="mt-4">
        Already have an account?{' '}
        <Link className="font-medium underline" href={`/login${query}`}>
          Sign in
        </Link>
      </p>
    </>
  );
}

export function VerifyEmail({ token }: { token?: string }) {
  const [state, setState] = useState<'working' | 'done' | 'failed'>(token ? 'working' : 'failed');
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api('/auth/verify-email', { body: { token } })
      .then(() => setState('done'))
      .catch(() => setState('failed'));
  }, [token]);
  if (state === 'working') return <p role="status">Verifying your email.</p>;
  return state === 'done' ? (
    <>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Email verified</h1>
      <p>You can now message sellers, make offers and publish listings.</p>
      <Link href="/login" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
        Sign in
      </Link>
    </>
  ) : (
    <>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">That link did not work</h1>
      <p>It may have expired or already been used. Sign in and request a new link from Settings.</p>
      <Link href="/login?next=/account/settings" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
        Sign in
      </Link>
    </>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/auth/forgot-password', { body: values });
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  if (sent) {
    return (
      <>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Check your email</h1>
        <p>If an account uses that address, a link to reset the password is on its way.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Reset your password</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" error={form.formState.errors.email?.message}>
          {(p) => <Input {...p} {...form.register('email')} type="email" autoComplete="email" autoFocus />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
    </>
  );
}

const newPasswordSchema = z.object({ password: passwordField });

export function ResetPasswordForm({ token }: { token?: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({ resolver: zodResolver(newPasswordSchema) });
  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await api('/auth/reset-password', { body: { token, password } });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  if (!token) {
    return (
      <>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">That link is incomplete</h1>
        <Link href="/forgot-password" className={buttonClass('primary', 'lg', 'w-full')}>
          Request a new link
        </Link>
      </>
    );
  }
  if (done) {
    return (
      <>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Password changed</h1>
        <p>Other devices have been signed out.</p>
        <Link href="/login" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
          Sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Choose a new password</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" error={form.formState.errors.password?.message} hint="At least 10 characters">
          {(p) => <Input {...p} {...form.register('password')} type="password" autoComplete="new-password" autoFocus />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Change password
        </Button>
      </form>
    </>
  );
}

type ProfileValues = { username?: string; locationId?: string | null; bio?: string | null };

export function WelcomeForm({ me, next }: { me: Me; next?: string }) {
  const { locations } = useCatalog();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema.pick({ username: true, locationId: true, bio: true })),
    defaultValues: { username: me.username, locationId: me.location?.id ?? null, bio: me.bio ?? '' },
  });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api('/me', { method: 'PATCH', body: { ...values, bio: values.bio?.trim() || null } });
      window.location.assign(safeNext(next));
    } catch (e) {
      setError(applyServerErrors(e, form.setError, ['username', 'locationId', 'bio']));
    }
  });
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Set up your profile</h1>
      <p className="mb-5 text-muted">Buyers and sellers see these details on your profile.</p>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Username" error={errors.username?.message}>
          {(p) => <Input {...p} {...form.register('username')} autoComplete="username" />}
        </Field>
        <Field label="Your usual area" hint="We start your searches here. It shows on your profile.">
          {(p) => (
            <Select {...p} {...form.register('locationId', { setValueAs: (v) => v || null })}>
              <option value="">Choose later</option>
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
        <Field label="About you (optional)" error={errors.bio?.message}>
          {(p) => <Textarea {...p} {...form.register('bio')} rows={3} />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Save profile
        </Button>
      </form>
    </>
  );
}
