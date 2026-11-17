import type { Metadata } from 'next';
import Link from 'next/link';
import { OFFLINE_PAGE } from '@/components/copy/common';

export const metadata: Metadata = { title: OFFLINE_PAGE.title };

/** Fallback for navigations the service worker has not cached (U11.3). No client data. */
export default function OfflinePage() {
  return (
    <section className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="font-display text-2xl font-bold">{OFFLINE_PAGE.title}</h1>
      <p className="mt-3 text-muted">{OFFLINE_PAGE.body}</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-bold text-accent-ink"
      >
        {OFFLINE_PAGE.home}
      </Link>
    </section>
  );
}
