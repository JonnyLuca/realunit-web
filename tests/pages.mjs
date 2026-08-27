// Single source of truth for the dev-server port, the pages under test, the
// Playwright projects (viewports) and the visual matrix. Imported by
// playwright.config.mjs, scripts/dev-server.mjs, scripts/check-visual.mjs and
// every spec so the matrix is declared exactly once.

export const PORT = 4173;

// Every public HTML page, used by the smoke spec. `/confirm-aktionariat/` and
// `/account-merge/` load with no query params, so they render the "invalid link"
// state without making a network request.
export const PAGES = [
  '/',
  '/confirm-aktionariat/',
  '/account-merge/',
  '/404.html',
  '/invite/AB12CD?mock=1',
  '/promo/EVT1?mock=1',
];

// Viewports the visual suite renders: desktop, a real tablet width, and a phone.
export const PROJECTS = ['desktop-chromium', 'tablet-chromium', 'mobile-safari'];

// The visual matrix. Each VIEW is one screenshot scenario:
//   slug     — baseline filename (without extension), unique across the matrix
//   path     — URL to load (query string carries ?mock=/?lang= where needed)
//   platform — optional forced platform ('ios' | 'android'); applied via a UA
//              override before the page scripts run, so platform.js sets
//              html[data-platform] deterministically regardless of the device
//   waitFor  — optional confirm/merge-page state ('confirmed' | 'already-completed' |
//              'invalid' | 'no-registration' | 'unavailable') to wait for before the
//              shot (the ?mock hook renders it after a short delay)
//   projects — the viewports this view applies to
//
// Coverage: the landing page in both its equal-badge (desktop/tablet) and
// platform-matched (iOS/Android phone) layouts, every confirm-page end state in
// both languages and both the desktop and phone confirmed variants, every
// account-merge end state (same pattern), and the 404 page — each on the
// viewports where it differs.
export const VIEWS = [
  // Landing — equal-badge layout (desktop/tablet get no data-platform).
  { slug: 'home', path: '/', projects: ['desktop-chromium', 'tablet-chromium'] },
  // Landing — platform-matched layout, the matching store badge enlarged.
  { slug: 'home-ios', path: '/', platform: 'ios', projects: ['mobile-safari'] },
  { slug: 'home-android', path: '/', platform: 'android', projects: ['mobile-safari'] },

  // Confirm-page language is pinned explicitly per view: the page's default
  // follows navigator.language (Playwright's default locale is en-US), so the DE
  // and EN views set ?lang= to snapshot each language deterministically.
  // Confirm — confirmed state, German, desktop copy ("return on your phone").
  {
    slug: 'confirm-confirmed',
    path: '/confirm-aktionariat/?mock=confirmed&lang=de',
    waitFor: 'confirmed',
    projects: ['desktop-chromium', 'tablet-chromium'],
  },
  // Confirm — confirmed state on a phone: the "back to the app" button appears.
  {
    slug: 'confirm-confirmed-mobile',
    path: '/confirm-aktionariat/?mock=confirmed&lang=de',
    platform: 'ios',
    waitFor: 'confirmed',
    projects: ['mobile-safari'],
  },
  // Confirm — confirmed state, English copy.
  {
    slug: 'confirm-confirmed-en',
    path: '/confirm-aktionariat/?mock=confirmed&lang=en',
    waitFor: 'confirmed',
    projects: ['desktop-chromium'],
  },
  // Confirm — invalid state (bad/expired link).
  {
    slug: 'confirm-invalid',
    path: '/confirm-aktionariat/?mock=invalid&lang=de',
    waitFor: 'invalid',
    projects: ['desktop-chromium', 'tablet-chromium', 'mobile-safari'],
  },
  {
    slug: 'confirm-invalid-en',
    path: '/confirm-aktionariat/?mock=invalid&lang=en',
    waitFor: 'invalid',
    projects: ['desktop-chromium'],
  },
  // Confirm — no-registration state (email confirmed, no wallet registration
  // matched it — a permanent outcome, no retry CTA).
  {
    slug: 'confirm-no-registration',
    path: '/confirm-aktionariat/?mock=no-registration&lang=de',
    waitFor: 'no-registration',
    projects: ['desktop-chromium', 'tablet-chromium', 'mobile-safari'],
  },
  {
    slug: 'confirm-no-registration-en',
    path: '/confirm-aktionariat/?mock=no-registration&lang=en',
    waitFor: 'no-registration',
    projects: ['desktop-chromium'],
  },
  // Confirm — service unavailable (the retry button is shown).
  {
    slug: 'confirm-unavailable',
    path: '/confirm-aktionariat/?mock=unavailable&lang=de',
    waitFor: 'unavailable',
    projects: ['desktop-chromium', 'mobile-safari'],
  },
  {
    slug: 'confirm-unavailable-en',
    path: '/confirm-aktionariat/?mock=unavailable&lang=en',
    waitFor: 'unavailable',
    projects: ['desktop-chromium'],
  },

  // Account-merge — confirmed state, German, desktop copy ("return on your phone").
  {
    slug: 'merge-confirmed',
    path: '/account-merge/?mock=confirmed&lang=de',
    waitFor: 'confirmed',
    projects: ['desktop-chromium', 'tablet-chromium'],
  },
  // Account-merge — confirmed state on a phone: the "back to the app" button appears.
  {
    slug: 'merge-confirmed-mobile',
    path: '/account-merge/?mock=confirmed&lang=de',
    platform: 'ios',
    waitFor: 'confirmed',
    projects: ['mobile-safari'],
  },
  // Account-merge — confirmed state, English copy.
  {
    slug: 'merge-confirmed-en',
    path: '/account-merge/?mock=confirmed&lang=en',
    waitFor: 'confirmed',
    projects: ['desktop-chromium'],
  },
  // Account-merge — already-completed state (HTTP 409 / already merged).
  {
    slug: 'merge-already-completed',
    path: '/account-merge/?mock=already-completed&lang=de',
    waitFor: 'already-completed',
    projects: ['desktop-chromium', 'mobile-safari'],
  },
  {
    slug: 'merge-already-completed-en',
    path: '/account-merge/?mock=already-completed&lang=en',
    waitFor: 'already-completed',
    projects: ['desktop-chromium'],
  },
  // Account-merge — invalid state (bad/expired link).
  {
    slug: 'merge-invalid',
    path: '/account-merge/?mock=invalid&lang=de',
    waitFor: 'invalid',
    projects: ['desktop-chromium', 'tablet-chromium', 'mobile-safari'],
  },
  {
    slug: 'merge-invalid-en',
    path: '/account-merge/?mock=invalid&lang=en',
    waitFor: 'invalid',
    projects: ['desktop-chromium'],
  },
  // Account-merge — service unavailable (the retry button is shown).
  {
    slug: 'merge-unavailable',
    path: '/account-merge/?mock=unavailable&lang=de',
    waitFor: 'unavailable',
    projects: ['desktop-chromium', 'mobile-safari'],
  },
  {
    slug: 'merge-unavailable-en',
    path: '/account-merge/?mock=unavailable&lang=en',
    waitFor: 'unavailable',
    projects: ['desktop-chromium'],
  },

  // Custom 404 page.
  {
    slug: 'notfound',
    path: '/404.html',
    projects: ['desktop-chromium', 'tablet-chromium', 'mobile-safari'],
  },
];

// Projects a given view applies to.
export function projectsForView(view) {
  return view.projects;
}

// Every (view, project) pair that should produce a baseline.
export function visualMatrix() {
  const pairs = [];
  for (const view of VIEWS) {
    for (const project of projectsForView(view)) {
      pairs.push({ view, project });
    }
  }
  return pairs;
}
