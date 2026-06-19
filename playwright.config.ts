import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/*.spec.ts'],
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5000',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: ['smoke/**/*.spec.ts'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'critical',
      testMatch: ['critical/**/*.spec.ts'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'full',
      testMatch: ['full/**/*.spec.ts'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'chromium',
      testMatch: ['**/*.spec.ts'],
      testIgnore: ['mobile/**', 'smoke/**', 'critical/**', 'full/**'],
      use: { browserName: 'chromium' },
    },
    {
      name: 'mobile-chromium',
      testMatch: ['mobile/**/*.spec.ts'],
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
