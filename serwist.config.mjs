// @ts-check
// Serwist configurator mode (UI-3). `serwist build` runs after `next build`, so every
// prerendered route (/, /log, /history, /settings, /offline) is precached automatically.
import { generateGlobPatterns, serwist } from '@serwist/next/config';

export default serwist({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // The default patterns skip fonts, so offline screens would lose Chakra Petch.
  // The self-hosted font files are about 60 KB in total.
  globPatterns: [...generateGlobPatterns('.next/'), '.next/static/media/**/*.woff2'],
});
