/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Service worker source (design section 11). Built by `serwist build` into public/sw.js.
// Type-checked by tsconfig.sw.json, not the app tsconfig, because it needs the webworker lib.
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Updates wait for the user (U11.6). Until the update toast exists (task 13.1), a waiting
  // worker takes over on the next launch.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache the coach API (U11.4). This rule comes first so defaultCache cannot match it.
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

self.addEventListener('message', (event) => {
  if (event.data && (event.data as { type?: unknown }).type === 'SKIP_WAITING') void self.skipWaiting();
});

serwist.addEventListeners();
