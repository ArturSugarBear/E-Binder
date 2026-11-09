import { defineConfig, devices } from '@playwright/test';

const externalURL = process.env.E2E_BASE_URL;
const chromiumLaunch = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ['--no-sandbox'],
    }
  : {};
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalURL ?? 'http://127.0.0.1:4173/E-Binder/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // API-mocking tests must not be intercepted by the production service worker.
    // pwa.spec.ts explicitly enables SWs to verify real offline behavior.
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunch },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        launchOptions: chromiumLaunch,
      },
    },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: externalURL
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/E-Binder/',
        reuseExistingServer: !process.env.CI,
      },
});
