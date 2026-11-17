'use client';

import { useStorageStatus } from '@/data/hooks';
import { ScreenHeader } from './ScreenHeader';
import { Skeleton } from './Skeleton';

interface ScreenProps {
  title: string;
  /** Skeleton block heights in rem, shown while the store is loading. */
  skeleton: readonly number[];
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Common screen frame. Renders the skeleton until the data store is ready, so the server
 * and the first client render never show data-dependent text (U1.5).
 */
export function Screen({ title, skeleton, action, children }: ScreenProps) {
  const { status } = useStorageStatus();
  return (
    <section aria-busy={status === 'loading'} className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <ScreenHeader title={title}>{action}</ScreenHeader>
      {status === 'loading' ? <Skeleton blocks={skeleton} /> : children}
    </section>
  );
}
