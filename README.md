# realunit.app

The website served at **realunit.app**. Public, static.

## v1 (current)

A minimal landing page — one hero image from the RealUnit app plus the store buttons —
plus invite/promo landings and the Aktionariat confirm / account-merge flows.
Deliberately **without a build toolchain**: plain HTML + assets in `public/`,
uploaded to Cloudflare Pages.

- `public/index.html` — landing, shows `assets/hero.jpg` centered on a light background
  with the store/download buttons below it
- `public/invite/` and `public/promo/` — referral and campaign landings; look up
  `GET /v1/realunit/referral/code/:code` (contract:
  [JonnyLuca/dfx-referral-api](https://github.com/JonnyLuca/dfx-referral-api)),
  open `realunit-wallet://invite|promo/{code}`,
  and pass the code as a Play install referrer. Path and query codes
  (including ads/Play `utm_content` / `referrer` and Facebook/Google/Outlook
  `u=` / `q=` / `url=` / email `link=` wrapping `invite=` or a landing URL, with or without
  `https://`; a campaign name in `utm_content` does not hide a later wrapper key;
  an empty or foreign `code=` does not hide a later `invite=` / `promo=`;
  short `ios-app://` alternate links; Proofpoint URL Defense and Outlook Safe Links wrapping a
  RealUnit landing; a foreign `https://` URL is not a code) are
  uppercased, stripped of messenger zero-width/fullwidth characters and
  trailing sentence punct (`!`, `?`, `/`, …), and capped at 32 like the
  API lookup — including in the crawler HTML bytes Safari snapshots.
  The re-tap hint is iOS-only;
  Android keeps the code via the Play referrer. An App Store / Play / CTA tap
  also copies the code (user gesture) so an iOS badge install can still be
  pasted at registration. iOS `format-detection` is `telephone=no, date=no`
  so Safari does not turn the campaign code or Aktionstext date into a link.
  `#ok-code` and `#ok-body` also set `x-apple-data-detectors="false"` because
  those strings are written after load.
  `www.realunit.app/invite|promo` is HTTP 200 (not a
  301 to the apex) so Universal Links and the Smart App Banner keep the host.
  The Smart App Banner `app-argument`, `og:url`, `rel=canonical`,
  `twitter:url`, `og:title`, `twitter:title`, `og:description`,
  `twitter:description`, `og:image:alt`, `twitter:image:alt`, `og:locale`,
  `og:site_name`, Play install referrer,
  android-app / ios-app alternate links, Facebook App Links
  (`al:ios:url` / `al:android:url` are `realunit-wallet://…`; `al:android:class`
  is `swiss.realunit.app.MainActivity`; `al:web:url`
  is the HTTPS landing), and Twitter App Card `twitter:app:url:*` (same
  custom scheme; `twitter:app:country` is CH) are injected
  into the HTML bytes from the request URL (`functions/_middleware.js` on
  Cloudflare Pages, and the local dev-server) so Safari, Play, WhatsApp, X,
  and share crawlers can snapshot them before JS. `og:title`, `og:description`,
  and image alt name the campaign code; `?lang=en` sets English copy and `og:locale=en_GB`;
  invitee names wait for lookup JS. `/js/invite-banner.js` in `<head>`
  is the CSP-safe JS fallback — Cloudflare Pages CSP blocks inline `<script>`.
- `public/.well-known/apple-app-site-association` and `assetlinks.json` — Universal
  Links / App Links for `/invite/*` and `/promo/*` on apex and www (HTTP 200,
  no 301). `sha256_cert_fingerprints`
  lists the v2 signing cert of GitHub release APK `realunit-1.2.17.apk`
  (`O=DFX AG`, `CN=Konstantin Ullrich`). If Play App Signing uses
  a different app-signing key, add that SHA-256 from Play Console beside them.
- `public/platform.js` — enlarges the store button matching the visitor's platform
  (iOS → App Store, Android → Play Store); without JS all buttons stay equal-size
- `public/assets/hero.jpg` — hero (source: the app's splash background)
- `public/assets/og.png` — social sharing image (source: the app's Android feature graphic)
- `public/assets/favicon.svg` — app icon
- `public/_headers` — security headers + cache-control for Cloudflare Pages

## Branching & deployment

Same `develop → main` flow as the other DFX Cloudflare-Pages sites (e.g. `landing-page`):

- Feature branches → PR into **`develop`** (default branch)
- Push to `develop` → `.github/workflows/dev.yaml` deploys `public/` to the DEV
  Pages project `realunit-web-dev` → **dev.realunit.app**
- `.github/workflows/auto-release-pr.yaml` opens/updates a `develop → main` release PR
- Merge to `main` → `.github/workflows/prd.yaml` deploys `public/` to the PRD
  Pages project `realunit-web` → **realunit.app**

Both deploys are Direct Upload via `wrangler pages deploy` (no build step).

Required repo secrets (both environments share them):

- `CLOUDFLARE_API_TOKEN` — scoped to _Account → Cloudflare Pages: Edit_
- `CLOUDFLARE_ACCOUNT_ID`

The custom domains `realunit.app` / `dev.realunit.app` are attached to the Pages
projects in the DNS/deployment configuration. The `handbook.` subdomain is unaffected.

## Roadmap (v2+)

- Legal pages — rendered from the app's `assets/legal/*.md` (build-time fetch, single source)

From v2 a build toolchain (Astro) is introduced; the plain-image landing stays the home page.

## Testing

The site still ships verbatim — the tooling is dev-only. Pure browser logic lives
in `public/js/lib/**` and is unit-tested to 100% (Vitest + jsdom); the pages,
platform detection and the full confirm flow are covered by Playwright
(functional + screenshot regression). See [CONTRIBUTING](CONTRIBUTING.md#quality-gates)
for the gate list and commands (`npm run check`, `npm run test:e2e`,
`npm run e2e:docker`).
