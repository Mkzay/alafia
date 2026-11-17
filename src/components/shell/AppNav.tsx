'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/components/copy/common';

const LINKS = [
  { href: '/', label: NAV.home },
  { href: '/history', label: NAV.history },
  { href: '/settings', label: NAV.settings },
] as const;

const item =
  'flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md px-2 text-sm font-medium';

/** Bottom navigation (U1.2). Hidden on the Log sheet. */
export function AppNav() {
  const pathname = usePathname();
  if (pathname === '/log') return null;

  return (
    <nav
      aria-label={NAV.label}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md items-center gap-1 px-3 py-2">
        {LINKS.slice(0, 1).map((l) => (
          <li key={l.href} className="flex flex-1">
            <Link
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={`${item} ${pathname === l.href ? 'text-accent' : 'text-muted'}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href="/log"
            className="flex min-h-12 min-w-24 items-center justify-center rounded-lg bg-accent px-5 font-display text-base font-bold text-accent-ink"
          >
            {NAV.log}
          </Link>
        </li>
        {LINKS.slice(1).map((l) => (
          <li key={l.href} className="flex flex-1">
            <Link
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={`${item} ${pathname === l.href ? 'text-accent' : 'text-muted'}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
