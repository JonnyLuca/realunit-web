import { defineConfig, devices } from '@playwright/test';
import { PORT, PROJECTS } from './tests/pages.mjs';

const BASE_URL = `http://127.0.0.1:${PORT}`;

const DEVICE_FOR = {
  'desktop-chromium': devices['Desktop Chrome'],
  // Real tablet width: 834px sits inside the `@media (max-width: 640px)` layer's
  // sibling range and exercises the wide-viewport layout on a smaller canvas.
  'tablet-chromium': { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1112 } },
  'mobile-safari': devices['iPhone 15'],
};

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  // Screenshots must be byte-for-byte reproducible against the committed
  // baselines, which are generated in the pinned Playwright container.
  snapshotPathTemplate: 'tests/__screenshots__/{projectName}/{arg}{ext}',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0,
    },
  },
  use: {
    baseURL: BASE_URL,
    // Swiss product default. Without this, Desktop Chrome's en-US navigator
    // selects English copy and DE assertions wait out the 10s expect timeout.
    locale: 'de-CH',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/html' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  projects: PROJECTS.map((name) => {
    const device = DEVICE_FOR[name];
    if (!device) {
      throw new Error(`playwright.config: no device mapping for project "${name}"`);
    }
    return { name, use: { ...device } };
  }),
  webServer: {
    command: 'node scripts/dev-server.mjs',
    url: BASE_URL,
    // Always start our own server on PORT so the suite never silently tests
    // against an unrelated process that happens to occupy the port.
    reuseExistingServer: false,
    env: { PORT: String(PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
