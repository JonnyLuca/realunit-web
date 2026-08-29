import { expect, test } from '@playwright/test';
import { VIEWS, projectsForView } from './pages.mjs';
import { installVisualDeterminism, settle } from './helpers.mjs';

test.describe('visual regression', () => {
  for (const view of VIEWS) {
    // Do not request the `page` fixture up front: Playwright launches the
    // project browser before `test.skip()` runs, so a view that does not
    // apply to this project (invite-ok on mobile-safari, invite-ok-ios on
    // desktop) would fail in 1ms if that browser cannot start.
    test(`${view.slug}`, async ({ playwright }, testInfo) => {
      if (!projectsForView(view).includes(testInfo.project.name)) {
        test.skip();
        return;
      }

      const browserName = testInfo.project.use.browserName || 'chromium';
      const browser = await playwright[browserName].launch();
      const context = await browser.newContext(testInfo.project.use);
      const page = await context.newPage();
      try {
        await installVisualDeterminism(page, { platform: view.platform });
        await page.goto(view.path, { waitUntil: 'load' });
        await settle(page);

        // Confirm-page views render their end state via the ?mock hook after a short
        // delay; wait for it before the shot. The page has no <video>/<canvas>, so no
        // masking is needed and the whole page is byte-compared.
        if (view.waitFor) {
          await page.waitForSelector(`#state-${view.waitFor}:not([hidden])`, {
            state: 'visible',
          });
        }

        await expect(page).toHaveScreenshot(`${view.slug}.png`, { fullPage: true });
      } finally {
        await context.close();
        await browser.close();
      }
    });
  }
});
