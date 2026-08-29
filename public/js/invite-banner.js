/**
 * Smart App Banner app-argument from the invite/promo URL.
 * Must load from <head> as a same-origin file: Cloudflare Pages CSP
 * (`default-src 'self'`) blocks inline <script>, so a banner install
 * would drop the code if this ran only in invite.js at </body>.
 * Production HTML already has app-argument from functions/_middleware.js
 * (Safari snapshots the meta from the bytes); this is the JS fallback
 * for local files and previews that do not run Pages Functions.
 */
(function () {
  'use strict';
  if (window.RealUnitInvite) {
    window.RealUnitInvite.applyItunesBannerFromLocation(document, location);
  }
})();
