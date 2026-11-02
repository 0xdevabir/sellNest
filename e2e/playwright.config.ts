import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against a stack that is already up: `pnpm infra:up`, the API and the web app.
 * It writes real rows to whichever database that stack uses, so never point it at production.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: './tests/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
});
