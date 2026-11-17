'use client';

import { useEffect, useRef } from 'react';

let firstMount = true;

/**
 * The screen's main heading. Focus moves here on every route change (U12.3), including
 * when Cache Components re-shows a hidden route, but not on the very first page load.
 */
export function ScreenHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (firstMount) {
      firstMount = false;
      return;
    }
    ref.current?.focus();
  }, []);

  return (
    <header className="flex items-center justify-between gap-3 pb-4">
      <h1 ref={ref} tabIndex={-1} className="font-display text-2xl font-bold text-text outline-none">
        {title}
      </h1>
      {children}
    </header>
  );
}
