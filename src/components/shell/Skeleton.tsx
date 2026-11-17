import { LOADING } from '@/components/copy/common';

interface SkeletonProps {
  /** Heights in rem for each block, matching the screen's layout. */
  blocks: readonly number[];
}

/** Placeholder boxes shown while the store is loading (U1.5). Never a spinner alone. */
export function Skeleton({ blocks }: SkeletonProps) {
  return (
    <div role="status" aria-label={LOADING.label} className="flex flex-col gap-3">
      {blocks.map((h, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="rounded-md bg-surface motion-safe:animate-pulse"
          style={{ height: `${h}rem` }}
        />
      ))}
    </div>
  );
}
