import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// Runs against a production build, because the service worker is disabled in `next dev`.
// Build first with `pnpm build`. Set E2E_BASE_URL to test a deployed URL instead.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    viewport: { width: 360, height: 740 },
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm exec next start -p ${PORT}`, port: PORT, reuseExistingServer: false, timeout: 120_000 },
});
