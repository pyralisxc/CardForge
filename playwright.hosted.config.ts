import { defineConfig, devices } from '@playwright/test';

const rawBaseUrl = process.env.CARDFORGE_E2E_BASE_URL?.trim();
if (!rawBaseUrl) throw new Error('CARDFORGE_E2E_BASE_URL is required for hosted smoke checks.');
const baseURL = /^https?:\/\//u.test(rawBaseUrl) ? rawBaseUrl : `https://${rawBaseUrl}`;

export default defineConfig({
  testDir: './tests/product/hosted-smoke',
  reporter: 'line',
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'hosted-chromium', use: { ...devices['Desktop Chrome'] } }],
});
