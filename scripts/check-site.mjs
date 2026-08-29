#!/usr/bin/env node
/**
 * Static-site completeness gate for realunit.app.
 *
 * Fails closed (exit 1) on structural defects a contributor could ship without
 * noticing on a no-build static site:
 *   - a page whose <html> has no valid `lang`
 *   - an internal link / asset reference that does not resolve to a file under
 *     public/ (the same resolution the dev server and Cloudflare Pages use)
 *   - index.html without an https og:url to anchor the site origin
 *   - a page that loads a glue script without first loading the js/lib core it
 *     depends on (platform.js → platform-core.js, confirm.js → confirm-core.js,
 *     merge.js → merge-core.js)
 *
 * i18n key parity (de/en) and the data-i18n coverage of the confirm page live in
 * the unit test (test/confirm-core.test.mjs), which can import the copy directly.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const PUBLIC = join(root, 'public');
const LANGS = ['de', 'en'];
const errors = [];
const fail = (msg) => errors.push(msg);
const read = (absPath) => readFileSync(absPath, 'utf8');

function listHtml(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listHtml(full));
    else if (extname(entry) === '.html') out.push(full);
  }
  return out;
}
const htmlFiles = listHtml(PUBLIC).sort();

// --- origin ------------------------------------------------------------------
// Derive the canonical origin from index.html's og:url so the gate follows the
// site if the domain ever moves.
function extractOgUrl(html) {
  const meta = html.match(/<meta\b[^>]*\bproperty=["']og:url["'][^>]*>/i);
  if (!meta) return null;
  const content = meta[0].match(/\bcontent=["']([^"']+)["']/i);
  return content ? content[1] : null;
}
const indexOgUrl = extractOgUrl(read(join(PUBLIC, 'index.html')));
if (!indexOgUrl) {
  fail('public/index.html: no og:url to derive the site origin from');
}
let ORIGIN = null;
if (indexOgUrl) {
  const url = new URL(indexOgUrl);
  if (url.protocol !== 'https:') fail(`public/index.html: og:url "${indexOgUrl}" is not https`);
  ORIGIN = url.origin;
}

// --- path resolution (mirrors scripts/dev-server.mjs / Cloudflare Pages) ------
function resolvesToFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.split('#')[0].split('?')[0]);
  } catch {
    return false;
  }
  let rel = decoded.replace(/^\/+/, '');
  if (rel === '') rel = 'index.html';
  let target = join(PUBLIC, rel);
  if (!target.startsWith(PUBLIC)) return false;
  if (existsSync(target) && statSync(target).isDirectory()) {
    target = join(target, 'index.html');
  }
  return existsSync(target) && statSync(target).isFile();
}

function checkReference(label, value) {
  const raw = value.trim();
  if (!raw) return;
  if (/^(mailto:|tel:|#)/i.test(raw)) return;
  if (/^\/\//.test(raw)) return; // protocol-relative → external
  // Any non-http(s) URI scheme (data:, realunit-wallet://, …) is not a file.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return;

  let pathname;
  if (/^https?:\/\//i.test(raw)) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      fail(`${label}: unparsable URL "${raw}"`);
      return;
    }
    if (url.origin !== ORIGIN) return; // external asset/link
    pathname = url.pathname;
  } else {
    pathname = ('/' + raw.replace(/^\.?\//, '')).split('#')[0].split('?')[0];
  }

  if (!resolvesToFile(pathname)) {
    fail(`${label}: internal reference does not resolve — "${raw}"`);
  }
}

// A page that loads a glue script must load its js/lib core first, or the glue
// throws on window.RealUnit* before it can run.
function checkScriptOrder(label, html, gluePath, corePath) {
  const glueIndex = html.indexOf(gluePath);
  if (glueIndex === -1) return;
  const coreIndex = html.indexOf(corePath);
  if (coreIndex === -1) {
    fail(`${label}: loads ${gluePath} but never loads its dependency ${corePath}`);
  } else if (coreIndex > glueIndex) {
    fail(`${label}: ${corePath} must be loaded before ${gluePath}`);
  }
}

let referenceCount = 0;
for (const file of htmlFiles) {
  const label = 'public/' + relative(PUBLIC, file);
  const html = read(file);

  const langMatch = html.match(/<html\b[^>]*\blang=["']([^"']+)["']/i);
  if (!langMatch) {
    fail(`${label}: <html> has no lang attribute`);
  } else if (!LANGS.includes(langMatch[1])) {
    fail(`${label}: <html lang="${langMatch[1]}"> is not one of ${LANGS.join(', ')}`);
  }

  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    referenceCount += 1;
    checkReference(label, match[1]);
  }

  checkScriptOrder(label, html, '/platform.js', '/js/lib/platform-core.js');
  checkScriptOrder(label, html, '/confirm-aktionariat/confirm.js', '/js/lib/confirm-core.js');
  checkScriptOrder(label, html, '/account-merge/merge.js', '/js/lib/merge-core.js');
  checkScriptOrder(label, html, '/js/invite-banner.js', '/js/lib/invite-core.js');
  checkScriptOrder(label, html, '/invite/invite.js', '/js/lib/invite-core.js');
  checkScriptOrder(label, html, '/invite/invite.js', '/js/invite-banner.js');
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
    fail(`${label}: inline <script> is blocked by CSP; load a same-origin file`);
  }
}

const promoHtml = read(join(PUBLIC, 'promo', 'index.html'));
if (!promoHtml.includes('Promo-Code wird geladen')) {
  fail('public/promo/index.html: loading title must be promo copy, not invite');
}
for (const [label, html] of [
  ['public/invite/index.html', read(join(PUBLIC, 'invite', 'index.html'))],
  ['public/promo/index.html', promoHtml],
]) {
  if (
    !html.includes('id="ok-code"') ||
    !html.includes('translate="no"') ||
    !html.includes('notranslate')
  ) {
    fail(`${label}: invite/promo code must be marked notranslate`);
  }
  if (!html.includes('id="ok-copy"')) {
    fail(`${label}: invite/promo must offer copy-code`);
  }
  if (
    !/format-detection[^>]*telephone=no/.test(html) ||
    !/format-detection[^>]*date=no/.test(html)
  ) {
    fail(
      `${label}: iOS must not auto-link the campaign code as a phone number or the Aktionstext date`,
    );
  }
  if (
    !/id="ok-code"[^>]*x-apple-data-detectors="false"/.test(html) ||
    !/id="ok-body"[^>]*x-apple-data-detectors="false"/.test(html)
  ) {
    fail(
      `${label}: JS-inserted campaign code and Aktionstext must keep x-apple-data-detectors=false`,
    );
  }
  if (!html.includes('src="/js/invite-banner.js"')) {
    fail(
      `${label}: Smart App Banner must load /js/invite-banner.js from <head> (CSP blocks inline script)`,
    );
  }
  if (/apple-itunes-app[^>]*app-argument=/i.test(html)) {
    fail(
      `${label}: committed HTML must stay generic; app-argument is injected from the request URL`,
    );
  }
  if (/og:url[^>]*(?:invite|promo)\/[A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed og:url must stay generic; the request URL is injected`);
  }
  if (/rel="canonical"[^>]*(?:invite|promo)\/[A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed canonical must stay generic; the request URL is injected`);
  }
  if (/twitter:url[^>]*(?:invite|promo)\/[A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed twitter:url must stay generic; the request URL is injected`);
  }
  if (/og:title[^>]*(?:Einladung|Promo-Code) [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed og:title must stay generic; the request URL is injected`);
  }
  if (/twitter:title[^>]*(?:Einladung|Promo-Code) [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed twitter:title must stay generic; the request URL is injected`);
  }
  if (/og:image:alt[^>]*(?:Einladung|Promo-Code) [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed og:image:alt must stay generic; the request URL is injected`);
  }
  if (/twitter:image:alt[^>]*(?:Einladung|Promo-Code) [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed twitter:image:alt must stay generic; the request URL is injected`);
  }
  if (/og:description[^>]*dem Code [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed og:description must stay generic; the request URL is injected`);
  }
  if (/twitter:description[^>]*dem Code [A-Za-z0-9]/i.test(html)) {
    fail(`${label}: committed twitter:description must stay generic; the request URL is injected`);
  }
  if (/al:ios:url|al:android:url|al:android:class|al:web:url/.test(html)) {
    fail(`${label}: committed HTML must not bake Facebook App Links`);
  }
  if (/twitter:app:/.test(html)) {
    fail(`${label}: committed HTML must not bake Twitter App Card urls`);
  }
  if (
    /data-store="play"[^>]*referrer=/i.test(html) ||
    /referrer=[^"]*data-store="play"/i.test(html)
  ) {
    fail(`${label}: committed Play href must stay generic; the referrer is injected`);
  }
  if (/android-app:\/\//.test(html) || /ios-app:\/\//.test(html)) {
    fail(`${label}: committed HTML must not bake android-app/ios-app alternate hrefs`);
  }
  if (!html.includes('btn-copy-failed') || !html.includes('code-copy-failed')) {
    fail(`${label}: failed copy must have an error style on the button and code`);
  }
  if (!html.includes(':focus-visible')) {
    fail(`${label}: invite/promo must show a keyboard focus ring`);
  }
  if (!html.includes('#unavailable-cta:focus') || !html.includes('#invalid-home:focus')) {
    fail(`${label}: programmatic retry/home focus must show a focus ring`);
  }
  if (
    !html.includes('id="state-ok"') ||
    !html.includes('role="status"') ||
    !html.includes('aria-live="assertive"')
  ) {
    fail(`${label}: lookup states must be live regions`);
  }
  if (
    !html.includes('#state-invalid h1') ||
    !html.includes('#state-invalid p') ||
    !html.includes('--red:')
  ) {
    fail(`${label}: invalid heading and body must use the status red`);
  }
  if (!html.includes('aria-describedby="ok-code-hint"')) {
    fail(`${label}: code must be described by the hint`);
  }
  if (!html.includes('id="ok-code-hint" role="status" aria-live="polite" tabindex="-1"')) {
    fail(`${label}: checking hint must be a live region and focusable after retry`);
  }
  if (!html.includes('id="ok-retap"') || !html.includes('role="note"')) {
    fail(`${label}: iOS re-tap hint must be a note`);
  }
  if (
    !html.includes('id="unavailable-cta"') ||
    !html.includes('aria-describedby="unavailable-body"')
  ) {
    fail(`${label}: retry must be described by the unavailable body`);
  }
  if (!html.includes('id="invalid-status"') || !html.includes('id="unavailable-status"')) {
    fail(`${label}: invalid/unavailable copy must be a live region that does not wrap the CTAs`);
  }
  if (!html.includes('id="invalid-home"') || !html.includes('href="/"')) {
    fail(`${label}: invalid landing must offer a homepage link`);
  }
  if (!html.includes('id="unavailable-home"')) {
    fail(`${label}: unavailable landing must offer a homepage link beside retry`);
  }
  if (!html.includes('id="ok-pitch"')) {
    fail(`${label}: invite/promo must include the pitch in the code box`);
  }
  if (
    !html.includes('twitter:title') ||
    !html.includes('twitter:description') ||
    !html.includes('twitter:image:alt') ||
    !html.includes('twitter:url') ||
    !html.includes('og:locale') ||
    !html.includes('og:locale:alternate') ||
    !html.includes('og:site_name') ||
    !html.includes('theme-color')
  ) {
    fail(`${label}: invite/promo share preview must set Twitter tags, site name and locale`);
  }
  if (!html.includes('rel="canonical"')) {
    fail(`${label}: invite/promo must declare a canonical URL`);
  }
  if (!html.includes('id="ok-title"') || !html.includes('tabindex="-1"')) {
    fail(`${label}: lookup result heading must be focusable after load`);
  }
  if (!html.includes('id="ok-copy-link"') || !html.includes('only-desktop')) {
    fail(`${label}: desktop landing must offer copy-link`);
  }
  if (!html.includes('id="ok-desktop"')) {
    fail(`${label}: desktop landing must explain to open the link on a phone`);
  }
  if (
    html.includes('data-store="apple"') &&
    (html.includes('alt="Laden im App Store"') || html.includes('alt="Jetzt bei Google Play"'))
  ) {
    fail(`${label}: store badge inside an aria-labelled link must have empty alt`);
  }
  if (
    !html.includes('html[data-platform="ios"] .store-link[data-store="apple"]') ||
    !html.includes('html[data-platform="android"] .store-link[data-store="play"]')
  ) {
    fail(`${label}: matching store badge must lead on iOS/Android`);
  }
}

const inviteJs = read(join(PUBLIC, 'invite', 'invite.js'));
if (!inviteJs.includes('copyInFlight')) {
  fail('public/invite/invite.js: copy must ignore a second tap while writeText is in flight');
}
if (!inviteJs.includes('setCopyBusy')) {
  fail('public/invite/invite.js: copy must be disabled (aria-busy) while writeText is in flight');
}
if (!inviteJs.includes("codeEl.setAttribute('aria-disabled'")) {
  fail(
    'public/invite/invite.js: the code control must be aria-disabled while writeText is in flight',
  );
}
if (!inviteJs.includes('COPY_TIMEOUT_MS')) {
  fail('public/invite/invite.js: hung writeText must fall back after COPY_TIMEOUT_MS');
}
if (!inviteJs.includes('bindInstallHandoffCopy')) {
  fail(
    'public/invite/invite.js: App Store / Play / CTA tap must copy the code (iOS install handoff)',
  );
}
const bannerJsPath = join(PUBLIC, 'js', 'invite-banner.js');
if (!existsSync(bannerJsPath)) {
  fail('public/js/invite-banner.js is missing (CSP-safe Smart App Banner)');
} else if (!read(bannerJsPath).includes('applyItunesBannerFromLocation')) {
  fail('public/js/invite-banner.js: must set apple-itunes-app from the URL');
}
const bannerFnPath = join(root, 'functions', '_middleware.js');
const bannerLibPath = join(root, 'functions', 'lib', 'itunes-banner.js');
if (!existsSync(bannerFnPath)) {
  fail('functions/_middleware.js is missing (Safari snapshots apple-itunes-app from HTML bytes)');
} else {
  const fn = read(bannerFnPath);
  if (!fn.includes('injectLandingFromRequestUrl')) {
    fail(
      'functions/_middleware.js: must inject apple-itunes-app, og:url, canonical, and og:title from the request URL',
    );
  }
  if (!fn.includes('shouldRewriteItunesBanner')) {
    fail('functions/_middleware.js: must skip invite.js and other non-HTML assets');
  }
}
if (!existsSync(bannerLibPath)) {
  fail('functions/lib/itunes-banner.js is missing');
} else {
  const lib = read(bannerLibPath);
  if (!lib.includes('app-argument=realunit-wallet://')) {
    fail(
      'functions/lib/itunes-banner.js: must set app-argument to the custom-scheme invite/promo link',
    );
  }
  if (!lib.includes('og:url') || !lib.includes('canonical')) {
    fail('functions/lib/itunes-banner.js: must rewrite og:url and rel=canonical');
  }
  if (!lib.includes('referrer=') || !lib.includes('android-app://')) {
    fail('functions/lib/itunes-banner.js: must inject Play referrer and android-app alternate');
  }
  if (!lib.includes('twitter:url') || !lib.includes('al:ios:url')) {
    fail('functions/lib/itunes-banner.js: must inject twitter:url and Facebook App Links');
  }
  if (!lib.includes('al:android:class') || !lib.includes('swiss.realunit.app.MainActivity')) {
    fail('functions/lib/itunes-banner.js: must inject al:android:class MainActivity');
  }
  if (!lib.includes('twitter:app:url:iphone') || !lib.includes('twitter:app:url:googleplay')) {
    fail('functions/lib/itunes-banner.js: must inject Twitter App Card deep links');
  }
  if (!lib.includes('og:title') || !lib.includes('twitter:title')) {
    fail(
      'functions/lib/itunes-banner.js: must inject og:title and twitter:title from the request URL',
    );
  }
  if (!lib.includes('og:image:alt') || !lib.includes('twitter:image:alt')) {
    fail(
      'functions/lib/itunes-banner.js: must inject og:image:alt and twitter:image:alt from the request URL',
    );
  }
  if (!lib.includes('og:site_name')) {
    fail('functions/lib/itunes-banner.js: must inject og:site_name');
  }
  if (!lib.includes('og:description') || !lib.includes('shareDescription')) {
    fail('functions/lib/itunes-banner.js: must inject og:description from the request URL');
  }
  if (!lib.includes('og:locale') || !lib.includes("lang === 'en'")) {
    fail('functions/lib/itunes-banner.js: must inject og:locale from ?lang=en');
  }
}
const routesPath = join(PUBLIC, '_routes.json');
if (!existsSync(routesPath)) {
  fail('public/_routes.json is missing (Pages Function include for /invite|/promo)');
} else {
  try {
    const routes = JSON.parse(read(routesPath));
    const include = routes.include || [];
    const exclude = routes.exclude || [];
    if (!include.includes('/invite') || !include.includes('/invite/*')) {
      fail('public/_routes.json: must include /invite and /invite/*');
    }
    if (!include.includes('/promo') || !include.includes('/promo/*')) {
      fail('public/_routes.json: must include /promo and /promo/*');
    }
    if (!exclude.includes('/invite/invite.js')) {
      fail('public/_routes.json: must exclude /invite/invite.js');
    }
  } catch (e) {
    fail(`public/_routes.json: ${e instanceof Error ? e.message : e}`);
  }
}
if (!inviteJs.includes('keepLandingFocus')) {
  fail('public/invite/invite.js: show() must keep focus on copy, Retry, and home');
}
if (!inviteJs.includes('if (lookupInFlight) return')) {
  fail('public/invite/invite.js: Retry must ignore a second tap while lookup is in flight');
}
if (!inviteJs.includes('setRetryBusy') || !inviteJs.includes('retry.disabled')) {
  fail('public/invite/invite.js: Retry must be disabled (aria-busy) while lookup is in flight');
}
if (!inviteJs.includes('var retrying')) {
  fail('public/invite/invite.js: Retry must keep the unavailable copy while lookup reloads');
}
if (!inviteJs.includes('Budget elapsed')) {
  fail('public/invite/invite.js: hung lookup must show unavailable when the 15s budget elapses');
}
if (!inviteJs.includes('window.location.hash')) {
  fail('public/invite/invite.js: /invite#CODE must be parsed from the hash');
}

// Universal Link / App Link verification files for /invite and /promo.
const aasaPath = join(PUBLIC, '.well-known', 'apple-app-site-association');
if (!existsSync(aasaPath)) {
  fail('public/.well-known/apple-app-site-association is missing');
} else {
  try {
    const aasa = JSON.parse(read(aasaPath));
    const details = aasa?.applinks?.details;
    const first = Array.isArray(details) ? details[0] : null;
    const appId = 'N2BP27J7N6.swiss.realunit.app';
    const appIDs = first?.appIDs ?? [];
    if (first?.appID !== appId && !appIDs.includes(appId)) {
      fail('apple-app-site-association: missing appID N2BP27J7N6.swiss.realunit.app');
    }
    const paths = [...(first?.paths ?? []), ...(first?.components ?? []).map((c) => c['/'])];
    if (!paths.some((p) => p === '/invite')) {
      fail('apple-app-site-association: missing exact /invite');
    }
    if (!paths.some((p) => p === '/invite/*')) {
      fail('apple-app-site-association: missing /invite/*');
    }
    if (!paths.some((p) => p === '/promo')) {
      fail('apple-app-site-association: missing exact /promo');
    }
    if (!paths.some((p) => p === '/promo/*')) {
      fail('apple-app-site-association: missing /promo/*');
    }
  } catch (e) {
    fail(`apple-app-site-association: ${e instanceof Error ? e.message : e}`);
  }
}
const aasaAliasPath = join(PUBLIC, 'apple-app-site-association');
if (!existsSync(aasaAliasPath)) {
  fail(
    'public/apple-app-site-association is missing (Apple also fetches this path as HTTP 200, not a rewrite-only alias)',
  );
} else if (existsSync(aasaPath) && read(aasaAliasPath) !== read(aasaPath)) {
  fail('public/apple-app-site-association must match .well-known/apple-app-site-association');
}
// Invite/promo glue and js/lib cores must stay off the immutable cache so a
// landing-page update still rolls out. Cloudflare Pages `_headers` is the
// only place those Cache-Control values exist.
function parseCfHeaders(text) {
  const blocks = new Map();
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      current = line.trim();
      if (!blocks.has(current)) blocks.set(current, {});
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const name = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    blocks.get(current)[name] = value;
  }
  return blocks;
}

function requireHeader(blocks, path, name, pred, label) {
  const block = blocks.get(path);
  if (!block) {
    fail(`_headers: missing block for ${path}`);
    return;
  }
  const value = block[name];
  if (!value) {
    fail(`_headers: ${path} missing ${name}`);
    return;
  }
  if (pred && !pred(value)) fail(`_headers: ${path} ${name} ${label}`);
}

const headersPath = join(PUBLIC, '_headers');
if (!existsSync(headersPath)) {
  fail('public/_headers is missing');
} else {
  const blocks = parseCfHeaders(read(headersPath));
  const csp = blocks.get('/*')?.['content-security-policy'] || '';
  if (!csp) {
    fail('_headers: missing Content-Security-Policy on /*');
  } else if (
    /script-src[^;]*'unsafe-inline'/.test(csp) ||
    /default-src[^;]*'unsafe-inline'/.test(csp)
  ) {
    fail(
      '_headers: script must not allow unsafe-inline (Smart App Banner uses /js/invite-banner.js)',
    );
  }
  const notImmutable = (value) => /max-age=/i.test(value) && !/immutable/i.test(value);
  const jsonType = (value) => /application\/json/i.test(value);
  requireHeader(
    blocks,
    '/invite/invite.js',
    'cache-control',
    notImmutable,
    'must be a non-immutable max-age',
  );
  requireHeader(blocks, '/js/*', 'cache-control', notImmutable, 'must be a non-immutable max-age');
  requireHeader(
    blocks,
    '/invite/index.html',
    'cache-control',
    notImmutable,
    'must be a non-immutable max-age',
  );
  requireHeader(
    blocks,
    '/promo/index.html',
    'cache-control',
    notImmutable,
    'must be a non-immutable max-age',
  );
  requireHeader(
    blocks,
    '/invite/*',
    'cache-control',
    notImmutable,
    'must be a non-immutable max-age',
  );
  requireHeader(
    blocks,
    '/promo/*',
    'cache-control',
    notImmutable,
    'must be a non-immutable max-age',
  );
  requireHeader(
    blocks,
    '/.well-known/apple-app-site-association',
    'content-type',
    jsonType,
    'must be application/json',
  );
  requireHeader(
    blocks,
    '/.well-known/assetlinks.json',
    'content-type',
    jsonType,
    'must be application/json',
  );
}

const redirectsPath = join(PUBLIC, '_redirects');
if (!existsSync(redirectsPath)) {
  fail('public/_redirects is missing');
} else {
  const rules = read(redirectsPath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/));
  const hasRewrite = (from, to) =>
    rules.some((parts) => parts[0] === from && parts[1] === to && parts[2] === '200');
  const hasHost301 = (from, to) =>
    rules.some((parts) => parts[0] === from && parts[1] === to && parts[2] === '301');
  if (hasHost301('https://www.realunit.app/invite', 'https://realunit.app/invite')) {
    fail('_redirects: www /invite must be 200, not apex 301 (Universal Links)');
  }
  if (hasHost301('https://www.realunit.app/invite/*', 'https://realunit.app/invite/:splat')) {
    fail('_redirects: www /invite/* must be 200, not apex 301 (Universal Links)');
  }
  if (hasHost301('https://www.realunit.app/promo', 'https://realunit.app/promo')) {
    fail('_redirects: www /promo must be 200, not apex 301 (Universal Links)');
  }
  if (hasHost301('https://www.realunit.app/promo/*', 'https://realunit.app/promo/:splat')) {
    fail('_redirects: www /promo/* must be 200, not apex 301 (Universal Links)');
  }
  if (!hasRewrite('https://www.realunit.app/invite', '/invite/index.html')) {
    fail('_redirects: missing www /invite 200 (no 301)');
  }
  if (!hasRewrite('https://www.realunit.app/invite/*', '/invite/index.html')) {
    fail('_redirects: missing www /invite/* 200 (no 301)');
  }
  if (!hasRewrite('https://www.realunit.app/promo', '/promo/index.html')) {
    fail('_redirects: missing www /promo 200 (no 301)');
  }
  if (!hasRewrite('https://www.realunit.app/promo/*', '/promo/index.html')) {
    fail('_redirects: missing www /promo/* 200 (no 301)');
  }
  if (rules.some((parts) => parts[0] === 'https://www.realunit.app/*')) {
    fail('_redirects: catch-all www 301 would redirect AASA');
  }
  if (
    !hasRewrite(
      'https://www.realunit.app/.well-known/apple-app-site-association',
      '/.well-known/apple-app-site-association',
    )
  ) {
    fail('_redirects: missing www AASA 200 (no 301)');
  }
  if (
    !hasRewrite(
      'https://www.realunit.app/.well-known/assetlinks.json',
      '/.well-known/assetlinks.json',
    )
  ) {
    fail('_redirects: missing www assetlinks 200 (no 301)');
  }
  if (
    !hasRewrite(
      'https://www.realunit.app/apple-app-site-association',
      '/.well-known/apple-app-site-association',
    )
  ) {
    fail('_redirects: missing www /apple-app-site-association 200 (no 301)');
  }
  if (rules.some((parts) => String(parts[0]).includes('.well-known/') && parts[2] === '301')) {
    fail('_redirects: .well-known must not 301');
  }
  if (!hasRewrite('/invite', '/invite/index.html')) {
    fail('_redirects: missing /invite → /invite/index.html 200');
  }
  if (!hasRewrite('/invite/*', '/invite/index.html')) {
    fail('_redirects: missing /invite/* → /invite/index.html 200');
  }
  if (!hasRewrite('/promo', '/promo/index.html')) {
    fail('_redirects: missing /promo → /promo/index.html 200');
  }
  if (!hasRewrite('/promo/*', '/promo/index.html')) {
    fail('_redirects: missing /promo/* → /promo/index.html 200');
  }
}

const assetlinksPath = join(PUBLIC, '.well-known', 'assetlinks.json');
if (!existsSync(assetlinksPath)) {
  fail('public/.well-known/assetlinks.json is missing');
} else {
  try {
    const links = JSON.parse(read(assetlinksPath));
    if (!Array.isArray(links) || links.length === 0) {
      fail('assetlinks.json: expected a non-empty array');
    } else if (links[0]?.target?.package_name !== 'swiss.realunit.app') {
      fail('assetlinks.json: package_name must be swiss.realunit.app');
    } else if (!Array.isArray(links[0]?.target?.sha256_cert_fingerprints)) {
      fail('assetlinks.json: sha256_cert_fingerprints must be an array');
    } else {
      const fps = links[0].target.sha256_cert_fingerprints.map(String);
      const upload =
        '7F:8B:14:54:E2:91:E9:DB:56:21:69:0A:64:23:7C:34:80:78:C6:5B:B4:86:31:CA:02:9D:14:20:E6:3C:7B:40';
      if (!fps.includes(upload)) {
        fail('assetlinks.json: missing GitHub APK v1.2.17 upload SHA-256 (O=DFX AG)');
      }
      const sha = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
      for (const fp of fps) {
        if (!sha.test(fp)) {
          fail(`assetlinks.json: fingerprint is not SHA-256 hex pairs: ${fp}`);
        }
      }
    }
  } catch (e) {
    fail(`assetlinks.json: ${e instanceof Error ? e.message : e}`);
  }
}

if (errors.length > 0) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\ncheck-site: ${errors.length} error(s) across ${htmlFiles.length} HTML files.`);
  process.exit(1);
}
console.log(
  `check-site: OK — ${htmlFiles.length} HTML files, ${referenceCount} references checked.`,
);
