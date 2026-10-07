import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e-push",
  timeout: 30000,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "VITE_PUSH_ENABLED=true VITE_PUSH_ALLOWED_ORIGINS=http://127.0.0.1:3001 npm run dev -- --host 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
