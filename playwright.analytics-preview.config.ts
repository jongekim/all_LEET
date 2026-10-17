import { defineConfig, devices } from '@playwright/test';

// Isolated static preview: no application entry, Supabase client, or Vite HMR.
export default defineConfig({
  testDir: './e2e-previews',
  testMatch: 'admin-analytics-enhanced-preview.spec.ts',
  timeout: 30_000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'python3 -m http.server 4187 --bind 127.0.0.1 --directory docs/previews',
    url: 'http://127.0.0.1:4187/admin-analytics-enhanced.html',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
