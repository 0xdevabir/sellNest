import { cx } from './ui';

/** Nest mark: three curved twigs + a leaf, in brand sage. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cx('size-7 shrink-0', className)}
      aria-hidden
    >
      <path
        d="M6.5 20.5c2.8-4.2 7-6.5 9.5-6.5s6.7 2.3 9.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8.2 23.2c2.4-3.4 5.8-5.2 7.8-5.2s5.4 1.8 7.8 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M10.2 25.6c1.8-2.4 4.2-3.6 5.8-3.6s4 1.2 5.8 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.48"
      />
      <path
        d="M16 7.2c3.4 1.4 5.4 4.2 5.6 7.4-2.8-.2-5.2-1.6-6.6-3.8-1.2 2.2-3.4 3.6-6 3.8.4-3.4 2.6-6.2 7-7.4Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="16" cy="12.2" r="1.15" fill="var(--color-paper, #fafaf8)" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-lg font-bold tracking-tight text-ink', className)}>
      <LogoMark className={cx('text-accent-ink', markClassName)} />
      <span>SellNest</span>
    </span>
  );
}
