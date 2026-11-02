'use client';

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { api, toQuery } from '@/lib/api';
import { cx } from './ui';

interface Suggestions {
  titles: string[];
  categories: { slug: string; name: string }[];
}

export function SearchBox({ initial = '', className, large }: { initial?: string; className?: string; large?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(initial);
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => setValue(initial), [initial]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(t);
  }, [value]);

  const { data } = useQuery({
    queryKey: ['suggest', debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
    queryFn: ({ signal }) => api<Suggestions>(`/search/suggestions${toQuery({ q: debounced })}`, { signal }),
  });

  const options = [
    ...(data?.titles ?? []).map((t) => ({ label: t, href: `/explore${toQuery({ q: t })}` })),
    ...(data?.categories ?? []).map((c) => ({ label: `All in ${c.name}`, href: `/explore${toQuery({ category: c.slug })}` })),
  ];
  const show = open && debounced.length >= 2 && options.length > 0;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        go(active >= 0 && options[active] ? options[active].href : `/explore${toQuery({ q: value.trim() })}`);
      }}
    >
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        role="combobox"
        aria-label="Search listings"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={120}
        placeholder="Search for a laptop, desk, textbook"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === 'Escape') setOpen(false);
        }}
        className={cx(
          'w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[16px] sm:text-[15px] placeholder:text-muted',
          large ? 'h-12' : 'h-10',
        )}
      />
      {show && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
          {options.map((o, i) => (
            <li key={o.href} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(o.href)}
                className={cx('block w-full truncate px-3 py-2 text-left hover:bg-accent-soft', i === active && 'bg-accent-soft')}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
