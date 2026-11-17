'use client';

import { useEffect } from 'react';

/**
 * Plain production-only registration (design section 11). Updates apply on next launch
 * until the update toast lands in task 13.1 (UI-18).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);
  return null;
}
