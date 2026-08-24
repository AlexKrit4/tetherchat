import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';

/**
 * Every flow is exercised twice: once on a desktop viewport where the four-column
 * layout is live, and once on an iPhone-sized viewport where the app becomes a
 * single-panel stack. A regression in either layout fails the suite.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        // iPhone 14 metrics on Chromium: the same 390x844 viewport and touch
        // emulation, without needing a second browser download in CI.
        ...devices['iPhone 14'],
        browserName: 'chromium',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
