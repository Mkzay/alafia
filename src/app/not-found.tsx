import Link from 'next/link';
import { ERRORS } from '@/components/copy/common';

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="font-display text-2xl font-bold">{ERRORS.notFoundTitle}</h1>
      <p className="mt-3 text-muted">{ERRORS.notFoundBody}</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-accent px-5 font-bold text-accent-ink">
        {ERRORS.home}
      </Link>
    </section>
  );
}
