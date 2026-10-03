import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-prerender', timeout: 30_000, workers: 2,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node --import tsx scripts/preview-prerender.ts',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 30_000,
  },
});
