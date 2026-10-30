import { defineConfig } from '@playwright/test';

// One smoke test (PLAN.md Phase 6): order → demo pay → vendor ready → customer sees the alert.
// Runs against a production build: `npm run build`, then `npx playwright test`.
// Needs .env.local (Supabase keys, VENDOR_LOGIN_PASSWORD, DEMO_PAYMENTS=true).
// Uses the installed Google Chrome, so no browser download is needed.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3123',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    locale: 'th-TH',
  },
  webServer: {
    command: 'npx next start -p 3123',
    url: 'http://localhost:3123/login',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
