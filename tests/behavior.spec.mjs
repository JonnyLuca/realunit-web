import { expect, test } from '@playwright/test';
import { forcePlatform } from './helpers.mjs';

const CONFIRM_ENDPOINT = '**/v1/realunit/confirm-aktionariat**';

// Fulfil the confirm endpoint with a fixed status/body so the fetch → mapResult →
// render path runs deterministically without a live API call.
async function routeConfirm(page, { status = 200, body = {} } = {}) {
  await page.route(CONFIRM_ENDPOINT, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('platform detection', () => {
  test('a desktop visitor gets no data-platform attribute', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only');
    await page.goto('/');
    expect(await page.locator('html').getAttribute('data-platform')).toBeNull();
  });

  test('the iPhone device is detected as iOS', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-safari', 'phone-only');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'ios');
  });

  for (const platform of ['ios', 'android']) {
    test(`a forced ${platform} user-agent sets html[data-platform="${platform}"]`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop-chromium', 'runs once on desktop');
      await forcePlatform(page, platform);
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-platform', platform);
    });
  }

  test('the landing page links to the App Store, Play Store and the APK release', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'content check, once');
    await page.goto('/');
    await expect(page.locator('a[data-store="apple"]')).toHaveAttribute(
      'href',
      /apps\.apple\.com\/.*id6759720010/,
    );
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      /play\.google\.com\/.*id=swiss\.realunit\.app/,
    );
    await expect(page.locator('a[data-store="apk"]')).toHaveAttribute(
      'href',
      /github\.com\/RealUnitCH\/app\/releases\/latest/,
    );
  });
});

test.describe('confirm-aktionariat flow', () => {
  // The confirmation logic is device-agnostic; run it once on desktop.
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only confirm-flow checks');
  });

  test('a link without params shows the invalid state and makes no confirm request', async ({
    page,
  }) => {
    const confirmCalls = [];
    await page.route(CONFIRM_ENDPOINT, (route) => {
      confirmCalls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/confirm-aktionariat/');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page.locator('#state-loading')).toBeHidden();
    expect(confirmCalls).toEqual([]);
  });

  for (const state of ['confirmed', 'invalid', 'no-registration', 'unavailable']) {
    test(`?mock=${state} renders the ${state} state`, async ({ page }) => {
      await page.goto(`/confirm-aktionariat/?mock=${state}`);
      await expect(page.locator(`#state-${state}`)).toBeVisible();
    });
  }

  test('a valid link confirmed by the API shows the confirmed state and calls the DEV base', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirmed' }),
      });
    });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=CODE1&user=U1');
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('https://dev.api.dfx.swiss/v1/realunit/confirm-aktionariat');
    expect(requestedUrl).toContain('email=a%40b.ch');
    expect(requestedUrl).toContain('code=CODE1');
    expect(requestedUrl).toContain('user=U1');
  });

  test('the confirm GET lower-cases a mixed-case email but keeps code/user case-sensitive', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirmed' }),
      });
    });
    await page.goto('/confirm-aktionariat/?email=Mixed.Case%40Example.COM&code=CoDe1&user=Uu1');
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('email=mixed.case%40example.com');
    expect(requestedUrl).not.toContain('Example.COM');
    expect(requestedUrl).toContain('code=CoDe1');
    expect(requestedUrl).toContain('user=Uu1');
  });

  test('the confirm GET forwards extra mail-link params to the API but strips the web-only api knob', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirmed' }),
      });
    });
    // The link carries an extra param the API must audit (address) alongside the web's own control knob (api),
    // which selects the API base but must not itself be forwarded as a query param.
    await page.goto(
      '/confirm-aktionariat/?email=a%40b.ch&code=C&user=U&address=0xAbC123&api=https%3A%2F%2Fapi.example.test',
    );
    await expect(page.locator('#state-confirmed')).toBeVisible();
    // the extra mail-link param reaches the chosen API base...
    expect(requestedUrl).toContain('https://api.example.test/v1/realunit/confirm-aktionariat');
    expect(requestedUrl).toContain('address=0xAbC123');
    // ...while the web-only api knob is not forwarded as a query param.
    expect(requestedUrl).not.toContain('api=');
  });

  test('a duplicated modelled key forwards the validated first occurrence, not the last', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirmed' }),
      });
    });
    // A crafted link repeats email with a second value. hasRequiredParams gates on the
    // first occurrence (first@x.ch), so the forwarded confirm call must carry that same
    // first value (lowercased) and never the trailing second@y.ch — while genuine extra
    // params (address) still pass through verbatim.
    await page.goto(
      '/confirm-aktionariat/?email=first%40x.ch&code=C&user=U&address=0xAbC&email=second%40y.ch',
    );
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('email=first%40x.ch');
    expect(requestedUrl).not.toContain('second');
    expect(requestedUrl).toContain('address=0xAbC');
  });

  test('a 200 response with the invalid status shows the invalid state', async ({ page }) => {
    await routeConfirm(page, { status: 200, body: { status: 'invalid' } });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-invalid')).toBeVisible();
  });

  test('a 200 response with the confirmed_no_registration status shows the no-registration state', async ({
    page,
  }) => {
    await routeConfirm(page, { status: 200, body: { status: 'confirmed_no_registration' } });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-no-registration')).toBeVisible();
  });

  test('a non-2xx API response shows the unavailable state', async ({ page }) => {
    await routeConfirm(page, { status: 500, body: {} });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-unavailable')).toBeVisible();
  });

  test('a 200 response with an unrecognized status shows the unavailable state', async ({
    page,
  }) => {
    await routeConfirm(page, { status: 200, body: { status: 'weird' } });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-unavailable')).toBeVisible();
  });

  test('a network error shows the unavailable state', async ({ page }) => {
    await page.route(CONFIRM_ENDPOINT, (route) => route.abort());
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-unavailable')).toBeVisible();
  });

  test('the retry button re-runs the confirmation', async ({ page }) => {
    let calls = 0;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      calls += 1;
      const ok = calls > 1; // first attempt fails, the retry succeeds
      route.fulfill({
        status: ok ? 200 : 500,
        contentType: 'application/json',
        body: JSON.stringify(ok ? { status: 'confirmed' } : {}),
      });
    });
    await page.goto('/confirm-aktionariat/?email=a%40b.ch&code=C&user=U');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await page.locator('#retry').click();
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(calls).toBe(2);
  });

  test('?lang=en renders English copy and sets <html lang="en">', async ({ page }) => {
    await page.goto('/confirm-aktionariat/?mock=invalid&lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const expected = await page.evaluate(() => window.RealUnitConfirm.I18N.en['invalid.title']);
    await expect(page.locator('#state-invalid h1')).toHaveText(expected);
  });

  test('an ?api= override sends the confirmation to that API base', async ({ page }) => {
    let requestedUrl = null;
    await page.route(CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'confirmed' }),
      });
    });
    await page.goto(
      '/confirm-aktionariat/?email=a%40b.ch&code=C&user=U&api=https%3A%2F%2Fapi.example.test',
    );
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('https://api.example.test/v1/realunit/confirm-aktionariat');
  });
});

const MERGE_CONFIRM_ENDPOINT = '**/v1/auth/mail/confirm**';
const MERGE_JOB_ENDPOINT = '**/v1/job/**';

test.describe('account-merge flow', () => {
  // The merge logic is device-agnostic; run it once on desktop.
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only merge-flow checks');
  });

  test('a link without otp shows the invalid state and makes no confirm request', async ({
    page,
  }) => {
    const confirmCalls = [];
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/account-merge/');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page.locator('#state-loading')).toBeHidden();
    expect(confirmCalls).toEqual([]);
  });

  for (const state of ['confirmed', 'already-completed', 'invalid', 'unavailable']) {
    test(`?mock=${state} renders the ${state} state`, async ({ page }) => {
      await page.goto(`/account-merge/?mock=${state}`);
      await expect(page.locator(`#state-${state}`)).toBeVisible();
    });
  }

  test('a valid otp confirmed by the API shows the confirmed state and calls the DEV base', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kycHash: 'x' }),
      });
    });
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('https://dev.api.dfx.swiss/v1/auth/mail/confirm');
    expect(requestedUrl).toContain('code=abc');
  });

  test('a 409 response shows the already-completed state', async ({ page }) => {
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-already-completed')).toBeVisible();
  });

  test('a 400 response shows the invalid state', async ({ page }) => {
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-invalid')).toBeVisible();
  });

  test('a 202 job that completes then re-confirms shows the confirmed state', async ({ page }) => {
    let confirmCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls += 1;
      if (confirmCalls === 1) {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: 'job-1',
            status: 'Pending',
            expectedSeconds: 2,
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ kycHash: 'x' }),
        });
      }
    });
    await page.route(MERGE_JOB_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uid: 'job-1', status: 'Complete' }),
      }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-confirmed')).toBeVisible({ timeout: 10000 });
    expect(confirmCalls).toBe(2);
  });

  test('a 202 ticket already Complete skips job polling and re-confirms', async ({ page }) => {
    let confirmCalls = 0;
    let jobCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls += 1;
      if (confirmCalls === 1) {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: 'job-1',
            status: 'Complete',
            expectedSeconds: 2,
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ kycHash: 'x' }),
        });
      }
    });
    await page.route(MERGE_JOB_ENDPOINT, (route) => {
      jobCalls += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uid: 'job-1', status: 'Complete' }),
      });
    });
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-confirmed')).toBeVisible({ timeout: 10000 });
    expect(confirmCalls).toBe(2);
    expect(jobCalls).toBe(0);
  });

  test('a 202 ticket already Failed skips job polling and shows unavailable', async ({ page }) => {
    let confirmCalls = 0;
    let jobCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls += 1;
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'job-1',
          status: 'Failed',
          expectedSeconds: 2,
        }),
      });
    });
    await page.route(MERGE_JOB_ENDPOINT, (route) => {
      jobCalls += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uid: 'job-1', status: 'Failed' }),
      });
    });
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible({ timeout: 10000 });
    expect(confirmCalls).toBe(1);
    expect(jobCalls).toBe(0);
  });

  test('a 202 job with expectedSeconds 1 that is Complete on the first job GET still reaches confirmed', async ({
    page,
  }) => {
    let confirmCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls += 1;
      if (confirmCalls === 1) {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: 'job-1',
            status: 'Pending',
            expectedSeconds: 1,
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ kycHash: 'x' }),
        });
      }
    });
    await page.route(MERGE_JOB_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uid: 'job-1', status: 'Complete' }),
      }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-confirmed')).toBeVisible({ timeout: 10000 });
    expect(confirmCalls).toBe(2);
  });

  test('after Complete, a second confirm that returns another job-shaped 202 shows unavailable', async ({
    page,
  }) => {
    let confirmCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      confirmCalls += 1;
      if (confirmCalls === 1) {
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: 'job-1',
            status: 'Pending',
            expectedSeconds: 2,
          }),
        });
      } else {
        // Re-confirm after Complete still returns a job — that is an error, not a new budget.
        route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            uid: 'job-2',
            status: 'Pending',
            expectedSeconds: 60,
          }),
        });
      }
    });
    await page.route(MERGE_JOB_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ uid: 'job-1', status: 'Complete' }),
      }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible({ timeout: 10000 });
    expect(confirmCalls).toBe(2);
  });

  test('a job GET that returns 404 JSON without status shows unavailable without re-polling', async ({
    page,
  }) => {
    let jobCalls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) =>
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          uid: 'job-1',
          status: 'Pending',
          expectedSeconds: 60,
        }),
      }),
    );
    await page.route(MERGE_JOB_ENDPOINT, (route) => {
      jobCalls += 1;
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'not found' }),
      });
    });
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible({ timeout: 10000 });
    expect(jobCalls).toBe(1);
  });

  test('a network error shows the unavailable state', async ({ page }) => {
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => route.abort());
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible();
  });

  test('a 503 response shows the unavailable state', async ({ page }) => {
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible();
  });

  test('the retry button re-runs the confirmation', async ({ page }) => {
    let calls = 0;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      calls += 1;
      const ok = calls > 1; // first attempt fails, the retry succeeds
      route.fulfill({
        status: ok ? 200 : 503,
        contentType: 'application/json',
        body: JSON.stringify(ok ? { kycHash: 'x' } : {}),
      });
    });
    await page.goto('/account-merge/?otp=abc');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await page.locator('#retry').click();
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(calls).toBe(2);
  });

  test('?lang=en renders English copy and sets <html lang="en">', async ({ page }) => {
    await page.goto('/account-merge/?mock=invalid&lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const expected = await page.evaluate(() => window.RealUnitMerge.I18N.en['invalid.title']);
    await expect(page.locator('#state-invalid h1')).toHaveText(expected);
  });

  test('an ?api= override sends the confirmation to that API base', async ({ page }) => {
    let requestedUrl = null;
    await page.route(MERGE_CONFIRM_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kycHash: 'x' }),
      });
    });
    await page.goto('/account-merge/?otp=abc&api=https%3A%2F%2Fapi.example.test');
    await expect(page.locator('#state-confirmed')).toBeVisible();
    expect(requestedUrl).toContain('https://api.example.test/v1/auth/mail/confirm');
    expect(requestedUrl).toContain('code=abc');
  });
});

const REFERRAL_CODE_ENDPOINT = '**/v1/realunit/referral/code/**';

test.describe('invite and promo landing', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only invite-flow checks');
  });

  test('an invite path without a code is invalid and does not call the API', async ({ page }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page).toHaveTitle('Link ungültig oder abgelaufen');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Link ungültig oder abgelaufen',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Dieser Einladungs- oder Promo-Link ist ungültig oder bereits abgelaufen.',
    );
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      'content',
      'en_GB',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#E02523');
    await expect(page.locator('#invalid-home')).toBeVisible();
    await expect(page.locator('#invalid-home')).toBeFocused();
    await expect(page.locator('#invalid-home')).toHaveAttribute('href', '/');
    await expect(page.locator('#invalid-home')).toHaveText('Zur Startseite');
    expect(calls).toEqual([]);
    await page.goto('/invite');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await page.goto('/promo');
    await expect(page.locator('#state-invalid')).toBeVisible();
    expect(calls).toEqual([]);
  });

  test('a bare /invite?code= looks up the query code', async ({ page }) => {
    let requestedUrl = null;
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      });
    });
    await page.goto('/invite?code=AB12CD');
    await expect(page.locator('#state-ok')).toBeVisible();
    expect(requestedUrl).toContain('/v1/realunit/referral/code/AB12CD');
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
  });

  test('a wrapped {data: {...}} lookup still greets the invitee', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            kind: 'invite',
            inviterName: 'Björn',
            inviteeName: 'Alice',
          },
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
    await expect(page.locator('#ok-body')).toHaveText('Björn lädt dich ein zu RealUnit.');
  });

  test('a sibling data object does not hide invite greeting fields', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
          data: { kind: 'promo', actionText: 'ignore' },
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
    await expect(page.locator('#ok-body')).toHaveText('Björn lädt dich ein zu RealUnit.');
  });

  test('a successful invite lookup shows the greeting and the custom-scheme CTA', async ({
    page,
  }) => {
    let requestedUrl = null;
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
          actionText: '',
        }),
      });
    });
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-ok')).toBeVisible();
    expect(requestedUrl).toContain('/v1/realunit/referral/code/AB12CD');
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
    await expect(page.locator('#ok-title')).toBeFocused();
    await expect(page.locator('#ok-body')).toHaveText('Björn lädt dich ein zu RealUnit.');
    await expect(page.locator('#ok-title')).toHaveAttribute('translate', 'no');
    await expect(page.locator('#ok-title')).toHaveClass(/notranslate/);
    await expect(page.locator('#ok-body')).toHaveAttribute('translate', 'no');
    await expect(page.locator('#ok-body')).toHaveClass(/notranslate/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Hey Alice');
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      'Björn lädt dich ein zu RealUnit.',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Björn lädt dich ein zu RealUnit.',
    );
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      'content',
      'en_GB',
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      'Hey Alice',
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      'Björn lädt dich ein zu RealUnit.',
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      'Hey Alice',
    );
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
      'content',
      'Hey Alice',
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1988C6');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'de_CH');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      'https://realunit.app/assets/og.png',
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('link[rel="alternate"][data-android-app]')).toHaveAttribute(
      'href',
      'android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
    );
    await expect(page.locator('link[rel="alternate"][data-ios-app]')).toHaveAttribute(
      'href',
      'ios-app://6759720010/realunit-wallet/invite/AB12CD',
    );
    await expect(page.locator('#ok-retap')).toHaveText(/nochmals antippen/);
    await expect(page.locator('#ok-retap')).toBeHidden();
    await expect(page.locator('#ok-code')).toHaveText('AB12CD');
    await expect(page.locator('#ok-code')).toHaveAttribute('role', 'button');
    await expect(page.locator('#ok-code')).toHaveAttribute('translate', 'no');
    await expect(page.locator('#ok-code')).toHaveClass(/notranslate/);
    await expect(page.locator('#ok-code')).toHaveAttribute('lang', 'zxx');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-label', /AB12CD/);
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-describedby', 'ok-code-hint');
    await expect(page.locator('#state-ok')).toHaveAttribute('role', 'status');
    await expect(page.locator('#state-ok')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#ok-copy')).not.toHaveAttribute('aria-live');
    await expect(page.locator('#ok-copy')).toHaveAttribute('aria-label', /AB12CD/);
    await expect(page.locator('#ok-code-label')).toHaveText('Dein Code');
    await expect(page.locator('#ok-copy')).toHaveText('Code kopieren');
    await expect(page.locator('#ok-copy-link')).toBeVisible();
    await expect(page.locator('#ok-copy-link')).toHaveText('Link kopieren');
    await expect(page.locator('#ok-copy-link')).toHaveAttribute(
      'aria-label',
      /Link kopieren .*\/invite\/AB12CD$/,
    );
    await expect(page.locator('#ok-open')).toBeHidden();
    await expect(page.locator('#ok-cta')).toBeHidden();
    await expect(page.locator('#ok-cta')).toHaveAttribute(
      'href',
      'realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=swiss.realunit.app&referrer=invite%3DAB12CD',
    );
    await expect(page.locator('a[data-store="apple"]')).toHaveAttribute(
      'href',
      'https://apps.apple.com/ch/app/realunit/id6759720010',
    );
  });

  test('copy confirmation includes the code in the live label', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.clock.install();
    await expect(page.locator('#ok-copy')).not.toHaveAttribute('aria-live');
    await page.locator('#ok-copy').click();
    await expect(page.locator('#ok-copy')).toHaveText('Kopiert');
    await expect(page.locator('#ok-copy')).toHaveAttribute('aria-label', /Kopiert AB12CD/);
    await expect(page.locator('#ok-copy')).not.toHaveAttribute('aria-live');
    await expect(page.locator('#ok-code-hint')).toHaveText('Kopiert');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-label', /Kopiert AB12CD/);
    await page.clock.fastForward(500);
    await page.locator('#ok-copy').click();
    await page.clock.fastForward(1700);
    await expect(page.locator('#ok-copy')).toHaveText('Kopiert');
    await page.clock.fastForward(400);
    await expect(page.locator('#ok-copy')).toHaveText('Code kopieren');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-label', /Dein Code AB12CD/);
    await expect(page.locator('#ok-code-hint')).toHaveText(/Registrierung/);
  });

  test('failed copy does not announce Kopiert', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      });
      document.execCommand = function () {
        return false;
      };
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.locator('#ok-copy').click();
    await expect(page.locator('#ok-copy')).toHaveText('Code kopieren');
    await expect(page.locator('#ok-copy')).toHaveClass(/btn-copy-failed/);
    await expect(page.locator('#ok-code')).toHaveClass(/code-copy-failed/);
    await expect(page.locator('#ok-copy')).not.toHaveAttribute('aria-live');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-label', /Dein Code AB12CD/);
    await expect(page.locator('#ok-code-hint')).not.toHaveText('Kopiert');
    await page.locator('#ok-copy-link').click();
    await expect(page.locator('#ok-copy-link')).toHaveText('Link kopieren');
    await expect(page.locator('#ok-copy-link')).toHaveClass(/btn-copy-failed/);
    await expect(page.locator('#ok-copy-link')).not.toHaveAttribute('aria-live');
  });

  test('ignores a second copy tap while writeText is in flight', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      window.__copyWrites = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => {
            window.__copyWrites += 1;
            return new Promise(() => {});
          },
        },
      });
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.locator('#ok-copy').click();
    await expect(page.locator('#ok-copy')).toBeDisabled();
    await expect(page.locator('#ok-copy')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-disabled', 'true');
    await page.evaluate(() => document.getElementById('ok-copy').click());
    await page.evaluate(() => document.getElementById('ok-code').click());
    expect(await page.evaluate(() => window.__copyWrites)).toBe(1);
    await expect(page.locator('#ok-copy')).toHaveText('Code kopieren');
  });

  test('a hung writeText falls back after two seconds so copy is not stuck', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      window.__copyWrites = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => {
            window.__copyWrites += 1;
            return new Promise(() => {});
          },
        },
      });
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.locator('#ok-copy').click();
    expect(await page.evaluate(() => window.__copyWrites)).toBe(1);
    await page.waitForTimeout(2100);
    await page.locator('#ok-copy').click();
    expect(await page.evaluate(() => window.__copyWrites)).toBe(2);
  });

  test('code and link copy can run while the other writeText is in flight', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'copy-link is desktop-only');
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      window.__copyWrites = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => {
            window.__copyWrites += 1;
            return new Promise(() => {});
          },
        },
      });
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.locator('#ok-copy').click();
    await page.locator('#ok-copy-link').click();
    expect(await page.evaluate(() => window.__copyWrites)).toBe(2);
  });

  test('desktop copy-link copies the canonical invite URL', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    await expect(page.locator('#ok-copy-link')).toBeVisible();
    await expect(page.locator('#ok-copy-link')).toHaveAttribute(
      'aria-label',
      /Link kopieren .*\/invite\/AB12CD$/,
    );
    await expect(page.locator('#state-ok')).toBeVisible();
    await page.clock.install();
    await expect(page.locator('#ok-copy-link')).not.toHaveAttribute('aria-live');
    await page.locator('#ok-copy-link').click();
    await expect(page.locator('#ok-copy-link')).toHaveText('Kopiert');
    await expect(page.locator('#ok-copy-link')).toHaveAttribute(
      'aria-label',
      /Kopiert .*\/invite\/AB12CD$/,
    );
    await expect(page.locator('#ok-copy-link')).not.toHaveAttribute('aria-live');
    await expect(page.locator('#ok-code-hint')).toHaveText('Kopiert');
    await page.clock.fastForward(500);
    await page.locator('#ok-copy-link').click();
    await page.clock.fastForward(1700);
    await expect(page.locator('#ok-copy-link')).toHaveText('Kopiert');
    await page.clock.fastForward(400);
    await expect(page.locator('#ok-copy-link')).toHaveText('Link kopieren');
  });

  test('iOS shows the re-tap hint after a successful lookup', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await forcePlatform(page, 'ios');
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-retap')).toBeVisible();
    await expect(page.locator('#ok-code-box').locator('#ok-retap')).toBeVisible();
    await expect(page.locator('#ok-copy-link')).toBeHidden();
    await expect(page.locator('#ok-retap')).toHaveAttribute('role', 'note');
    await expect(page.locator('#ok-retap')).toHaveText(/Code unten kopieren/);
    await expect(page.locator('#ok-cta')).toBeVisible();
    await expect(page.locator('#ok-cta')).toHaveAttribute('aria-describedby', 'ok-retap');
    await expect(page.locator('a[data-store="apple"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('a[data-store="play"]')).not.toHaveAttribute('aria-current');
    await expect(page.locator('#ok-code')).toHaveText('AB12CD');
    await expect(page.locator('#ok-code-hint')).toHaveText(/Registrierung/);
  });

  test('App Store tap copies the code for iOS install handoff', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      }),
    );
    await forcePlatform(page, 'ios');
    await page.goto('/invite/AB12CD');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    await expect(page.locator('#state-ok')).toBeVisible();
    page.on('popup', (popup) => popup.close());
    await page.locator('a[data-store="apple"]').click();
    await expect(page.locator('#ok-copy')).toHaveText('Kopiert');
    await expect(page.locator('#ok-code-hint')).toHaveText('Kopiert');
  });

  test('an invalid lookup does not copy the code on an App Store tap', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/invite/NOPE');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.resolve() },
      });
    });
    await expect(page.locator('#state-invalid')).toBeVisible();
    page.on('popup', (popup) => popup.close());
    await page.locator('a[data-store="apple"]').click();
    await expect(page.locator('#ok-copy')).toHaveText('Code kopieren');
    await expect(page.locator('#ok-code-hint')).not.toHaveText('Kopiert');
  });

  test('iOS re-tap hint is visible while lookup is in flight', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(REFERRAL_CODE_ENDPOINT, async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      });
    });
    await forcePlatform(page, 'ios');
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#ok-code-box')).toBeVisible();
    await expect(page.locator('#ok-open')).toBeHidden();
    await expect(page.locator('#ok-retap')).toBeVisible();
    await expect(page.locator('#ok-cta')).toBeHidden();
    release();
    await expect(page.locator('#ok-cta')).toBeVisible();
    await expect(page.locator('#ok-retap')).toBeVisible();
  });

  test('Android hides the re-tap hint (Play Install Referrer keeps the code)', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'promo', actionText: '20 REALU extra' }),
      }),
    );
    await forcePlatform(page, 'android');
    await page.goto('/promo/EVT1');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-pitch')).toHaveText(/Promo-Code/);
    await expect(page.locator('#ok-retap')).toBeHidden();
    await expect(page.locator('#ok-copy-link')).toBeHidden();
    await expect(page.locator('#ok-cta')).toBeVisible();
    await expect(page.locator('#ok-cta')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('a[data-store="apple"]')).not.toHaveAttribute('aria-current');
    await expect(page.locator('#ok-cta')).toHaveAttribute(
      'href',
      /intent:\/\/realunit\.app\/promo\/EVT1#Intent;scheme=https;package=swiss\.realunit\.app/,
    );
    await expect(page.locator('#ok-code')).toHaveAttribute('aria-label', /EVT1/);
    await expect(page.locator('#ok-copy')).not.toHaveAttribute('aria-live');
    await expect(page.locator('#ok-copy')).toHaveAttribute('aria-label', /EVT1/);
  });

  test('CTA stays hidden until lookup finishes', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route(REFERRAL_CODE_ENDPOINT, async (route) => {
      await gate;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      });
    });
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#ok-code-box')).toBeVisible();
    await expect(page.locator('#ok-open')).toBeHidden();
    await expect(page.locator('#ok-copy-link')).toBeVisible();
    await expect(page.locator('#ok-desktop')).toBeVisible();
    await expect(page.locator('#ok-desktop')).toHaveText(/Smartphone/);
    await expect(page.locator('#ok-pitch')).toBeVisible();
    await expect(page.locator('#ok-pitch')).toHaveText(/Aktionärin/);
    await expect(page.locator('#ok-retap')).toBeHidden();
    await expect(page.locator('#state-loading')).toBeHidden();
    await expect(page.locator('#ok-code-hint')).toHaveText('Code wird geprüft…');
    await expect(page).toHaveTitle('Einladung wird geladen…');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Einladung wird geladen…',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Einen Moment bitte.',
    );
    await expect(page.locator('#ok-code-hint')).toHaveAttribute('role', 'status');
    await expect(page.locator('#ok-code-hint')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#ok-code-hint')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      /referrer=invite%3DAB12CD/,
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('link[rel="alternate"][data-android-app]')).toHaveAttribute(
      'href',
      'android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
    );
    release();
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page).toHaveTitle('RealUnit — Einladung');
    await expect(page.locator('#ok-open')).toBeHidden();
    await expect(page.locator('#ok-cta')).toBeHidden();
    await expect(page.locator('#ok-code-hint')).toHaveText(/Registrierung/);
    await expect(page.locator('#ok-code-hint')).toHaveAttribute('aria-busy', 'false');
  });

  test('a 404 invite is invalid; a 500 is unavailable', async ({ page }) => {
    let status = 404;
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({ status, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/invite/NOPE');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page).toHaveTitle('Link ungültig oder abgelaufen');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Dieser Einladungs- oder Promo-Link ist ungültig oder bereits abgelaufen.',
    );
    await expect(page.locator('#invalid-home')).toBeFocused();
    await expect(page.locator('#invalid-home')).toHaveCSS('outline-color', 'rgb(25, 136, 198)');
    await expect(page.locator('#invalid-home')).toBeVisible();
    await expect(page.locator('#invalid-home')).toHaveAttribute('href', '/');
    await expect(page.locator('#invalid-title')).toHaveCSS('color', 'rgb(224, 37, 35)');
    await expect(page.locator('#invalid-body')).toHaveCSS('color', 'rgb(224, 37, 35)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#E02523');
    await expect(page.locator('#invalid-status')).toHaveAttribute('role', 'status');
    await expect(page.locator('#invalid-status')).toHaveAttribute('aria-live', 'assertive');
    await expect(page.locator('#invalid-status #invalid-home')).toHaveCount(0);
    await expect(page.locator('#ok-code-box')).toBeHidden();
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010',
    );
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=swiss.realunit.app',
    );
    await expect(page.locator('a[data-store="play"]')).not.toHaveAttribute('href', /referrer=/);
    status = 500;
    await page.goto('/invite/NOPE');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page).toHaveTitle('Dienst vorübergehend nicht erreichbar');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Wir konnten den Code gerade nicht prüfen. Bitte versuche es später erneut.',
    );
    await expect(page.locator('#unavailable-status')).toHaveAttribute('role', 'status');
    await expect(page.locator('#unavailable-status')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#state-unavailable')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#unavailable-status #unavailable-cta')).toHaveCount(0);
    await expect(page.locator('#unavailable-status #unavailable-home')).toHaveCount(0);
    await expect(page.locator('#unavailable-cta')).toHaveAttribute(
      'aria-describedby',
      'unavailable-body',
    );
    await expect(page.locator('#unavailable-cta')).toBeFocused();
    await expect(page.locator('#unavailable-cta')).toHaveCSS('outline-color', 'rgb(25, 136, 198)');
    await expect(page.locator('#unavailable-home')).toBeVisible();
    await expect(page.locator('#unavailable-home')).toHaveAttribute('href', '/');
    await expect(page.locator('#unavailable-home')).toHaveText('Zur Startseite');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1988C6');
    await expect(page.locator('#ok-code-box')).toBeVisible();
    await expect(page.locator('#ok-code')).toHaveText('NOPE');
    await expect(page.locator('#ok-open')).toBeHidden();
    await expect(page.locator('#ok-pitch')).toHaveText(/Aktionärin/);
    await expect(page.locator('#ok-cta')).toHaveAttribute('href', 'realunit-wallet://invite/NOPE');
    await expect(page.locator('a[data-store="apple"]')).toBeVisible();
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      /referrer=invite%3DNOPE/,
    );
  });

  test('a NestJS unmounted-route 404 is unavailable, not expired', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 404,
          message: 'Cannot GET /v1/realunit/referral/code/TEST',
          error: 'Not Found',
        }),
      }),
    );
    await page.goto('/invite/TEST');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#state-invalid')).toBeHidden();
  });

  test('unavailable retry looks up again without a reload', async ({ page }) => {
    let calls = 0;
    let releaseSecond;
    const second = new Promise((resolve) => {
      releaseSecond = resolve;
    });
    await page.route(REFERRAL_CODE_ENDPOINT, async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{}',
        });
        return;
      }
      await second;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      });
    });
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeFocused();
    await page.locator('#unavailable-cta').click();
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeDisabled();
    await expect(page.locator('#unavailable-cta')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#ok-code-box')).toBeVisible();
    releaseSecond();
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText(/Alice/);
    await expect(page.locator('#ok-title')).toBeFocused();
    expect(calls).toBe(2);
  });

  test('unavailable retry ignores a second tap while lookup is in flight', async ({ page }) => {
    let calls = 0;
    await page.route(REFERRAL_CODE_ENDPOINT, async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{}',
        });
        return;
      }
      await new Promise(() => {});
    });
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeEnabled();
    await page.evaluate(() => {
      const btn = document.getElementById('unavailable-cta');
      btn.click();
      btn.click();
    });
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeDisabled();
    await expect(page.locator('#unavailable-cta')).toHaveAttribute('aria-busy', 'true');
    expect(calls).toBe(2);
  });

  test('unavailable retry that still fails returns focus to retry', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeFocused();
    await page.locator('#unavailable-cta').click();
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-cta')).toBeFocused();
  });

  test('409, 410 and 422 lookups are invalid', async ({ page }) => {
    let status = 409;
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({ status, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/invite/USED');
    await expect(page.locator('#state-invalid')).toBeVisible();
    status = 410;
    await page.goto('/invite/GONE');
    await expect(page.locator('#state-invalid')).toBeVisible();
    status = 422;
    await page.goto('/promo/BAD');
    await expect(page.locator('#state-invalid')).toBeVisible();
  });

  test('a percent-encoded invite path is looked up decoded', async ({ page }) => {
    let requestedUrl = null;
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      requestedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
        }),
      });
    });
    await page.goto('/invite/AB%2F12');
    await expect(page.locator('#state-ok')).toBeVisible();
    expect(requestedUrl).toContain('/v1/realunit/referral/code/AB%2F12');
    await expect(page.locator('#ok-cta')).toHaveAttribute(
      'href',
      'realunit-wallet://invite/AB%2F12',
    );
  });

  test('a blank inviter name uses the fallback body', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: '   ',
          inviteeName: 'Alice',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
    await expect(page.locator('#ok-title')).toHaveAttribute('translate', 'no');
    await expect(page.locator('#ok-body')).toHaveText('Du bist zu RealUnit eingeladen.');
    await expect(page.locator('#ok-body')).not.toHaveAttribute('translate');
  });

  test('a blank invitee name uses the fallback title', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: '   ',
        }),
      }),
    );
    await page.goto('/invite/AB12CD');
    await expect(page.locator('#ok-title')).toHaveText('Du bist eingeladen');
    await expect(page.locator('#ok-title')).not.toHaveAttribute('translate');
    await expect(page.locator('#ok-body')).toHaveText('Björn lädt dich ein zu RealUnit.');
    await expect(page.locator('#ok-body')).toHaveAttribute('translate', 'no');
  });

  test('a promo path without kind still uses promo copy', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actionText: '20 REALU extra' }),
      }),
    );
    await page.goto('/promo/EVT1');
    await expect(page.locator('#ok-title')).toHaveText('Promo-Code');
    await expect(page.locator('#ok-title')).not.toHaveAttribute('translate');
    await expect(page.locator('#ok-body')).toHaveText('20 REALU extra');
    await expect(page.locator('#ok-body')).toHaveAttribute('translate', 'no');
  });

  test('an invite path with campaign text and no kind still renders as promo', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actionText: '20 REALU extra' }),
      }),
    );
    await page.goto('/invite/EVT1');
    await expect(page.locator('#ok-title')).toHaveText('Promo-Code');
    await expect(page.locator('#ok-body')).toHaveText('20 REALU extra');
  });

  test('a promo path renders the API action text 1:1', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'promo', actionText: '20 REALU extra' }),
      }),
    );
    await page.goto('/promo/EVT1');
    await expect(page.locator('#ok-body')).toHaveText('20 REALU extra');
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      'https://play.google.com/store/apps/details?id=swiss.realunit.app&referrer=promo%3DEVT1',
    );
  });

  test('a promo path with lang=en prefers campaignTextEn', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'Promo',
          actionText: 'DE Aktion',
          campaignTextEn: 'EN campaign',
        }),
      }),
    );
    await page.goto('/promo/EVT1?lang=en');
    await expect(page.locator('#ok-body')).toHaveText('EN campaign');
    await expect(page.locator('#ok-body')).not.toHaveAttribute('lang');
  });

  test('an English landing marks German promo fallback with lang=de', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'promo', actionText: 'DE Aktion' }),
      }),
    );
    await page.goto('/promo/EVT1?lang=en');
    await expect(page.locator('#ok-body')).toHaveText('DE Aktion');
    await expect(page.locator('#ok-body')).toHaveAttribute('lang', 'de');
  });

  test('an English invite landing uses the inviter greeting, not leftover actionText', async ({
    page,
  }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
          actionText: 'DE action',
          actionTextEn: 'EN action',
        }),
      }),
    );
    await page.goto('/invite/AB12CD?lang=en');
    await expect(page.locator('#ok-body')).toHaveText('Björn is inviting you to RealUnit.');
    await expect(page.locator('#ok-body')).not.toHaveAttribute('lang');
  });

  test('an English invite landing ignores leftover German actionText', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          kind: 'invite',
          inviterName: 'Björn',
          inviteeName: 'Alice',
          actionText: 'DE action',
        }),
      }),
    );
    await page.goto('/invite/AB12CD?lang=en');
    await expect(page.locator('#ok-body')).toHaveText('Björn is inviting you to RealUnit.');
    await expect(page.locator('#ok-body')).not.toHaveAttribute('lang');
  });

  test('a promo payload without action text uses the fallback body', async ({ page }) => {
    await page.route(REFERRAL_CODE_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'promo' }),
      }),
    );
    await page.goto('/promo/EVT1');
    await expect(page.locator('#ok-body')).toHaveText(
      'Öffne die App, um den Promo-Code zu übernehmen.',
    );
  });

  test('Smart App Banner skips a foreign code= and uses a later invite=', async ({ page }) => {
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto('/invite?code=https://example.com/foo&invite=AB12CD&mock=1');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
  });

  test('Smart App Banner skips a foreign nested code= inside utm_content', async ({ page }) => {
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto(
      '/invite?utm_content=' +
        encodeURIComponent(
          'https://realunit.app/invite?code=https://example.com/foo&invite=AB12CD',
        ) +
        '&mock=1',
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
  });

  test('Smart App Banner skips a campaign utm_content and uses a later wrapper key', async ({
    page,
  }) => {
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto(
      '/invite?utm_content=summer-sale&link=' +
        encodeURIComponent('https://realunit.app/invite/AB12CD') +
        '&mock=1',
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
  });

  test('Smart App Banner unwraps email link= and ios-app utm_content', async ({ page }) => {
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto(
      '/invite?link=' + encodeURIComponent('https://realunit.app/invite/AB12CD') + '&mock=1',
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await page.goto(
      '/invite?utm_content=' + encodeURIComponent('ios-app://6759720010/invite/AB12CD') + '&mock=1',
    );
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await page.goto('/invite?link=hello&mock=1');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010',
    );
  });

  test('Smart App Banner carries the code before invite.js runs', async ({ page }) => {
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto('/invite/AB12CD?mock=1');
    await expect(page.locator('script[src="/js/invite-banner.js"]')).toHaveCount(1);
    await expect(page.locator('meta[name="format-detection"]')).toHaveAttribute(
      'content',
      'telephone=no, date=no',
    );
    await expect(page.locator('#ok-code')).toHaveAttribute('x-apple-data-detectors', 'false');
    await expect(page.locator('#ok-body')).toHaveAttribute('x-apple-data-detectors', 'false');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await page.goto('/promo/EVT1?mock=1');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://promo/EVT1',
    );
  });

  test('without the head banner script the HTML already carries app-argument', async ({ page }) => {
    await page.route('**/js/invite-banner.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.route('**/invite/invite.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      }),
    );
    await page.goto('/invite/AB12CD?mock=1');
    await expect(page.locator('meta[name="apple-itunes-app"]')).toHaveAttribute(
      'content',
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'href',
      /referrer=invite%3DAB12CD/,
    );
    await expect(page.locator('link[rel="alternate"][data-android-app]')).toHaveAttribute(
      'href',
      'android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
    );
    await expect(page.locator('link[rel="alternate"][data-ios-app]')).toHaveAttribute(
      'href',
      'ios-app://6759720010/realunit-wallet/invite/AB12CD',
    );
    await expect(page.locator('meta[name="twitter:url"]')).toHaveAttribute(
      'content',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      'content',
      'RealUnit',
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'RealUnit — Einladung AB12CD',
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      'RealUnit — Einladung AB12CD',
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      'RealUnit — Einladung AB12CD',
    );
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
      'content',
      'RealUnit — Einladung AB12CD',
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      'Öffne die RealUnit-App mit dem Code AB12CD.',
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      'Öffne die RealUnit-App mit dem Code AB12CD.',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Öffne die RealUnit-App mit dem Code AB12CD.',
    );
    await expect(page.locator('meta[property="al:ios:url"]')).toHaveAttribute(
      'content',
      'realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('meta[property="al:ios:app_store_id"]')).toHaveAttribute(
      'content',
      '6759720010',
    );
    await expect(page.locator('meta[property="al:android:package"]')).toHaveAttribute(
      'content',
      'swiss.realunit.app',
    );
    await expect(page.locator('meta[property="al:android:class"]')).toHaveAttribute(
      'content',
      'swiss.realunit.app.MainActivity',
    );
    await expect(page.locator('meta[property="al:android:url"]')).toHaveAttribute(
      'content',
      'realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('meta[property="al:web:url"]')).toHaveAttribute(
      'content',
      /\/invite\/AB12CD$/,
    );
    await expect(page.locator('meta[name="twitter:app:url:iphone"]')).toHaveAttribute(
      'content',
      'realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('meta[name="twitter:app:id:iphone"]')).toHaveAttribute(
      'content',
      '6759720010',
    );
    await expect(page.locator('meta[name="twitter:app:url:googleplay"]')).toHaveAttribute(
      'content',
      'realunit-wallet://invite/AB12CD',
    );
    await expect(page.locator('meta[name="twitter:app:id:googleplay"]')).toHaveAttribute(
      'content',
      'swiss.realunit.app',
    );
    await expect(page.locator('meta[name="twitter:app:country"]')).toHaveAttribute('content', 'CH');
    await page.goto('/invite/AB12CD?mock=1&lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_GB');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'RealUnit — Invitation AB12CD',
    );
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      'RealUnit — Invitation AB12CD',
    );
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      'Open the RealUnit app with code AB12CD.',
    );
  });

  test('?mock=1 does not call the API and greets the invitee', async ({ page }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/AB12CD?mock=1');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText('Hey Alice');
    expect(calls).toEqual([]);
  });

  test('?mock=fallback uses nameless invite and promo copy without calling the API', async ({
    page,
  }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/AB12CD?mock=fallback');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText('Du bist eingeladen');
    await expect(page.locator('#ok-body')).toHaveText('Du bist zu RealUnit eingeladen.');
    await page.goto('/promo/EVT1?mock=fallback');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('#ok-title')).toHaveText('Promo-Code');
    await expect(page.locator('#ok-body')).toHaveText(
      'Öffne die App, um den Promo-Code zu übernehmen.',
    );
    expect(calls).toEqual([]);
  });

  test('?mock=loading stays on the loading state and does not call the API', async ({ page }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/AB12CD?mock=loading');
    await expect(page.locator('#state-loading')).toBeVisible();
    await expect(page.locator('#loading-title')).toHaveText('Einladung wird geladen…');
    await page.goto('/promo/EVT1?mock=loading');
    await expect(page.locator('#state-loading')).toBeVisible();
    await expect(page.locator('#loading-title')).toHaveText('Promo-Code wird geladen…');
    expect(calls).toEqual([]);
  });

  test('?mock=spent shows already-used copy without calling the API', async ({ page }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/AB12CD?mock=spent');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page.locator('#invalid-title')).toHaveText('Code bereits eingelöst');
    await expect(page.locator('#invalid-body')).toHaveText(/bereits verwendet/);
    await page.goto('/invite/AB12CD?mock=spent&lang=en');
    await expect(page.locator('#invalid-title')).toHaveText('Code already used');
    await page.goto('/promo/EVT1?mock=spent&lang=de');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page.locator('#invalid-title')).toHaveText('Code bereits eingelöst');
    await expect(page.locator('#invalid-body')).toHaveText(/bereits verwendet/);
    expect(calls).toEqual([]);
  });

  test('?mock=invalid and ?mock=unavailable skip the API', async ({ page }) => {
    const calls = [];
    await page.route(REFERRAL_CODE_ENDPOINT, (route) => {
      calls.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/invite/AB12CD?mock=invalid');
    await expect(page.locator('#state-invalid')).toBeVisible();
    await expect(page.locator('#invalid-home')).toHaveText('Zur Startseite');
    await page.goto('/invite/AB12CD?mock=invalid&lang=en');
    await expect(page.locator('#invalid-home')).toHaveText('Back to homepage');
    await expect(page.locator('#invalid-home')).toHaveAttribute('href', '/');
    await page.goto('/promo/EVT1?mock=unavailable');
    await expect(page.locator('#state-unavailable')).toBeVisible();
    await expect(page.locator('#unavailable-home')).toHaveText('Zur Startseite');
    await page.goto('/promo/EVT1?mock=unavailable&lang=en');
    await expect(page.locator('#unavailable-home')).toHaveText('Back to homepage');
    await expect(page.locator('#unavailable-home')).toHaveAttribute('href', '/');
    expect(calls).toEqual([]);
  });

  test('promo mock copy includes the 200 REALU first-purchase floor', async ({ page }) => {
    await page.goto('/promo/EVT1?mock=1');
    await expect(page.locator('#ok-body')).toHaveText(/mindestens 200 RealUnit-Aktientoken/);
    await expect(page.locator('#ok-body')).toHaveText(/begrenzt auf 100 Einlösungen/);
  });

  test('promo mock with lang=en uses campaignTextEn', async ({ page }) => {
    await page.goto('/promo/EVT1?mock=1&lang=en');
    await expect(page.locator('#ok-body')).toHaveText(/at least 200 RealUnit share tokens/);
    await expect(page.locator('#ok-body')).toHaveText(/limited to 100 redemptions/);
  });

  test('English landings localize store badge labels', async ({ page }) => {
    await page.goto('/invite/AB12CD?mock=1&lang=en');
    await expect(page.locator('#state-ok')).toBeVisible();
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'en_GB');
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      'content',
      'de_CH',
    );
    await expect(page.locator('nav.stores')).toHaveAttribute('aria-label', 'Download the app');
    await expect(page.locator('a[data-store="apple"]')).toHaveAttribute(
      'aria-label',
      'Get RealUnit on the App Store',
    );
    await expect(page.locator('a[data-store="play"]')).toHaveAttribute(
      'aria-label',
      'Get RealUnit on Google Play',
    );
    await expect(page.locator('a[data-store="apple"] img')).toHaveAttribute('alt', '');
    await expect(page.locator('a[data-store="play"] img')).toHaveAttribute('alt', '');
  });
});
