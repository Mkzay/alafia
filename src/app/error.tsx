'use client';

import Link from 'next/link';
import { ERRORS } from '@/components/copy/common';

/** Route error boundary (U10.4). Never shows the error itself (U10.3). */
export default function RouteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section role="alert" className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="font-display text-2xl font-bold">{ERRORS.title}</h1>
      <p className="mt-3 text-muted">{ERRORS.body}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 rounded-lg bg-accent px-5 font-bold text-accent-ink"
        >
          {ERRORS.retry}
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-5">
          {ERRORS.home}
        </Link>
      </div>
    </section>
  );
}
