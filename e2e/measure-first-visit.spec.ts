import { test } from '@playwright/test';
import type { Request } from '@playwright/test';

// Measures real transferred bytes for a first visit in a fresh profile (task 2.2).
// Run with MEASURE=1 (and E2E_BASE_URL for a deployed URL). Prints a report; asserts nothing.
test.skip(!process.env.MEASURE, 'Set MEASURE=1 to run the first-visit size report.');

interface Row {
  url: string;
  bytes: number;
  fromWorker: boolean;
  fromCache: boolean;
}

test('first visit transfer size', async ({ page, context }) => {
  const rows: Row[] = [];
  const pending: Promise<void>[] = [];

  const record = (req: Request) => {
    pending.push(
      (async () => {
        const res = await req.response().catch(() => null);
        if (!res) return;
        await res.finished().catch(() => null);
        const sizes = await req.sizes().catch(() => null);
        const fromCache = (await res.headerValue('x-from-cache').catch(() => null)) === '1' || res.fromServiceWorker();
        rows.push({
          url: req.url(),
          // Encoded body plus headers is what crossed the network.
          bytes: sizes ? sizes.responseBodySize + sizes.responseHeadersSize : 0,
          fromWorker: Boolean(req.serviceWorker()),
          fromCache,
        });
      })(),
    );
  };
  context.on('request', record);

  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true }));
    }
  });
  // Let the precache finish downloading.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await Promise.all(pending);

  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  const sum = (rs: Row[]) => rs.reduce((a, r) => a + r.bytes, 0);
  const pageRows = rows.filter((r) => !r.fromWorker && !r.fromCache);
  const workerRows = rows.filter((r) => r.fromWorker);
  const total = sum(pageRows) + sum(workerRows);
  const top = [...rows].sort((a, b) => b.bytes - a.bytes).slice(0, 8);

  console.log(
    [
      `first visit to ${page.url()}`,
      `page requests:    ${pageRows.length} requests, ${kb(sum(pageRows))}`,
      `worker precache:  ${workerRows.length} requests, ${kb(sum(workerRows))}`,
      `total on network: ${kb(total)}`,
      'largest transfers:',
      ...top.map((r) => `  ${kb(r.bytes).padStart(9)}  ${r.fromWorker ? '[sw] ' : '     '}${new URL(r.url).pathname}`),
    ].join('\n'),
  );
});
