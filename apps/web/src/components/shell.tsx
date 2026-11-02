'use client';

import { Bell, ChevronDown, Heart, Home, MapPin, MessageCircle, Plus, Search, User } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { LocationDialog } from './location-picker';
import { useCatalog, useMe } from './providers';
import { SearchBox } from './search-box';
import { Avatar, buttonClass, cx } from './ui';

function Count({ n, label }: { n?: number; label: string }) {
  if (!n) return null;
  return (
    <span className="tabular absolute -right-1 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[11px] font-semibold leading-4 text-white">
      {n > 9 ? '9+' : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

const menuItem = 'block cursor-pointer rounded-sm px-2.5 py-2 outline-none data-[highlighted]:bg-accent-soft';

function CategoriesMenu() {
  const { categories } = useCatalog();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-10 items-center gap-1 rounded-md px-2.5 font-medium hover:bg-accent-soft">
        Categories <ChevronDown className="size-4" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-lg">
          {categories.map((c) => (
            <DropdownMenu.Item key={c.id} asChild className={menuItem}>
              <Link href={`/explore?category=${c.slug}`}>{c.name}</Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild className={menuItem}>
            <Link href="/explore">Everything</Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function AccountMenu() {
  const me = useMe()!;
  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.assign('/');
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger aria-label="Account menu" className="rounded-full">
        <Avatar name={me.displayName} url={me.avatarUrl} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border border-line bg-surface p-1 shadow-lg">
          <div className="px-2.5 py-2">
            <div className="font-semibold">{me.displayName}</div>
            <div className="text-sm text-muted">@{me.username}</div>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {[
            ['My listings', '/account'],
            ['Drafts', '/account/drafts'],
            ['Offers', '/account/offers'],
            ['Settings', '/account/settings'],
            ['Public profile', `/u/${me.username}`],
            ...(me.role !== 'USER' ? [['Admin', '/admin']] : []),
          ].map(([label, href]) => (
            <DropdownMenu.Item key={href} asChild className={menuItem}>
              <Link href={href!}>{label}</Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={menuItem} onSelect={signOut}>
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function iconLink(active: boolean) {
  return cx('relative inline-flex size-10 items-center justify-center rounded-md hover:bg-accent-soft', active && 'bg-accent-soft');
}

export function Header() {
  const me = useMe();
  const { place } = useCatalog();
  const pathname = usePathname();
  const [locationOpen, setLocationOpen] = useState(false);
  const placeButton = (
    <button
      type="button"
      onClick={() => setLocationOpen(true)}
      className="inline-flex h-10 min-w-0 items-center gap-1.5 rounded-md px-2 text-left hover:bg-accent-soft"
      aria-label={`Location: ${place.name}, within ${place.radiusKm} km. Change location`}
    >
      <MapPin className="size-4 shrink-0 text-accent-ink" aria-hidden />
      <span className="truncate text-sm font-medium">{place.name}</span>
    </button>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:h-16 md:gap-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
          SellNest
        </Link>
        <div className="min-w-0 max-w-48 flex-1 md:flex-none">{placeButton}</div>
        <SearchBox className="hidden flex-1 md:block" initial={undefined} />
        <div className="hidden md:block">
          <CategoriesMenu />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Link href="/explore" aria-label="Search" className={cx(iconLink(false), 'md:hidden')}>
            <Search className="size-5" aria-hidden />
          </Link>
          {me && (
            <>
              <Link href="/account/favorites" aria-label="Saved listings" className={cx(iconLink(pathname === '/account/favorites'), 'hidden md:inline-flex')}>
                <Heart className="size-5" aria-hidden />
              </Link>
              <Link href="/inbox" aria-label="Messages" className={cx(iconLink(pathname.startsWith('/inbox')), 'hidden md:inline-flex')}>
                <MessageCircle className="size-5" aria-hidden />
                <Count n={me.unreadMessages} label="unread messages" />
              </Link>
              <Link href="/notifications" aria-label="Notifications" className={iconLink(pathname === '/notifications')}>
                <Bell className="size-5" aria-hidden />
                <Count n={me.unreadNotifications} label="unread notifications" />
              </Link>
            </>
          )}
          <Link href="/sell" className={buttonClass('accent', 'sm', 'mx-1 hidden md:inline-flex')}>
            Sell an item
          </Link>
          {me ? (
            <span className="hidden md:inline-flex">
              <AccountMenu />
            </span>
          ) : (
            <Link href="/login" className={buttonClass('ghost', 'sm')}>
              Sign in
            </Link>
          )}
        </div>
      </div>
      <LocationDialog open={locationOpen} onOpenChange={setLocationOpen} />
    </header>
  );
}

export function MobileNav() {
  const me = useMe();
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Home', icon: Home, active: pathname === '/' },
    { href: '/explore', label: 'Explore', icon: Search, active: pathname.startsWith('/explore') },
    { href: '/sell', label: 'Sell', icon: Plus, active: pathname.startsWith('/sell') },
    { href: '/inbox', label: 'Inbox', icon: MessageCircle, active: pathname.startsWith('/inbox'), count: me?.unreadMessages },
    { href: '/account', label: 'Profile', icon: User, active: pathname.startsWith('/account') },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon, active, count }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cx('flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]', active ? 'font-semibold text-ink' : 'text-muted')}
            >
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                <Count n={count} label="unread" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const groups: [string, [string, string][]][] = [
    ['Marketplace', [['Explore listings', '/explore'], ['Sell an item', '/sell'], ['Create an account', '/register']]],
    ['Staying safe', [['Safety tips', '/safety'], ['Prohibited items', '/prohibited-items']]],
    ['About', [['Contact', '/contact'], ['Terms', '/terms'], ['Privacy', '/privacy']]],
  ];
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-lg font-bold tracking-tight">SellNest</div>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Buy nearby. Sell easily. Buyers and sellers arrange payment and handover themselves; SellNest does not process payments.
          </p>
        </div>
        {groups.map(([title, links]) => (
          <div key={title}>
            <h2 className="font-semibold">{title}</h2>
            <ul className="mt-2 space-y-1.5">
              {links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
