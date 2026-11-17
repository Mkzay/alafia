import { expect, test } from '@playwright/test';

// Task 1.7 (and 2.2 against the live URL): the four screen shells load with no network
// after the first visit, uncached pages fall back to /offline, and /api/ is never cached.
const SCREENS = [
  { path: '/', heading: 'Your character' },
  { path: '/log', heading: 'Log a quest' },
  { path: '/history', heading: 'History' },
  { path: '/settings', heading: 'Settings' },
];

test('screens work offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the worker is active and controls this page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
      );
    }
  });
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  // The manifest is linked and served.
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifest = await (await page.request.get(manifestHref!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );

  await context.setOffline(true);

  for (const s of SCREENS) {
    await page.goto(s.path);
    await expect(page.getByRole('heading', { level: 1, name: s.heading })).toBeVisible();
  }

  // A full reload with no network still works.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  // An uncached page falls back to /offline.
  await page.goto('/not-cached-anywhere');
  await expect(page.getByRole('heading', { level: 1, name: "You're offline" })).toBeVisible();

  // Nothing under /api/ is in any cache.
  const apiEntries = await page.evaluate(async () => {
    const hits: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) {
        if (new URL(req.url).pathname.startsWith('/api/')) hits.push(req.url);
      }
    }
    return hits;
  });
  expect(apiEntries).toEqual([]);
});
