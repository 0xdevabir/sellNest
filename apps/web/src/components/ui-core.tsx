// Safe in both Server and Client Components, so keep it free of 'use client' and hooks.
import Link from 'next/link';

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
const SIZES = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4', lg: 'h-12 px-5 text-base', icon: 'size-11' };

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
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
