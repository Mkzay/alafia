// @ts-check
// Serwist configurator mode (UI-3). `serwist build` runs after `next build`.
import { readFileSync } from 'node:fs';
import { generateGlobPatterns, serwist } from '@serwist/next/config';

// The app shell routes are listed explicitly. Automatic detection of prerendered routes
// worked locally but found none in Vercel's build output, so the live worker precached no
// HTML (task 2.2). The revision is the Next.js build id, so every deploy refreshes the pages
// together with the chunks they reference.
const SHELL_ROUTES = ['/', '/log', '/history', '/settings', '/offline'];
const revision = readFileSync('.next/BUILD_ID', 'utf8').trim();

export default serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  precachePrerendered: false,
  additionalPrecacheEntries: SHELL_ROUTES.map((url) => ({ url, revision })),
  // The default patterns skip fonts. Match them anywhere under .next/static, because Vercel
  // places static files under .next/static/immutable/.
  globPatterns: [...generateGlobPatterns('.next/'), '.next/static/**/*.woff2'],
});
