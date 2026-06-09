import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['playwright-exhaustive.spec.ts', 'playwright-walkthrough-*.spec.ts', 'playwright-user-chain.spec.ts', 'playwright-business-*.spec.ts'],
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:9677',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      testIgnore: ['playwright-walkthrough-mobile.spec.ts'],
    },
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
      testMatch: ['playwright-walkthrough-mobile.spec.ts'],
    },
  ],
});
