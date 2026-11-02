'use client';

import { Loader2, X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import Link from 'next/link';
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-ink-soft',
  accent: 'bg-accent text-ink hover:bg-[#98ae90]',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-accent-soft',
  ghost: 'text-ink hover:bg-accent-soft',
  danger: 'bg-danger text-white hover:bg-[#92201a]',
};
const SIZES = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4', lg: 'h-12 px-5 text-base' };

export function buttonClass(variant: keyof typeof VARIANTS = 'primary', size: keyof typeof SIZES = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export const inputClass =
  'block w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-[16px] sm:text-[15px] placeholder:text-muted aria-[invalid=true]:border-danger disabled:bg-paper disabled:text-muted';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx(inputClass, 'pr-8', className)} {...rest} />;
});

/** Label, control, hint and error, tied together for assistive technology. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cx(
        'rounded-md px-4 py-3 text-sm',
        tone === 'info' && 'bg-accent-soft text-ink',
        tone === 'warn' && 'bg-warn-soft text-warn-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'dark' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-line text-ink',
        tone === 'good' && 'bg-accent-soft text-accent-ink',
        tone === 'warn' && 'bg-warn-soft text-warn-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'dark' && 'bg-ink text-white',
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <div className="mx-auto mt-1 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cx(
            'fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-lg bg-surface p-5 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
            wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
          )}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close aria-label="Close" className="-m-1 rounded-md p-1 hover:bg-accent-soft">
              <X className="size-5" aria-hidden />
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mb-4 text-muted">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Keep as is
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export function Pagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link className={buttonClass('outline', 'sm')} href={href(page - 1)} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={buttonClass('outline', 'sm', 'pointer-events-none opacity-50')}>Previous</span>
      )}
      <span className="tabular text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className={buttonClass('outline', 'sm')} href={href(page + 1)} rel="next">
          Next
        </Link>
      ) : (
        <span className={buttonClass('outline', 'sm', 'pointer-events-none opacity-50')}>Next</span>
      )}
    </nav>
  );
}

export function Avatar({ name, url, size = 36 }: { name: string; url?: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
