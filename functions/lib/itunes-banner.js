/**
 * Inject Smart App Banner app-argument into invite/promo HTML bytes.
 * Safari snapshots apple-itunes-app from the first HTML, before
 * /js/invite-banner.js runs (Offerte Punkt 3). Keep in sync with
 * public/js/lib/invite-core.js itunesBanner + parseCodeFromLocation
 * for canonical /invite|promo/{code} URLs, including ads/Play
 * utm_content / referrer and Facebook/Google/Outlook u= / q= / url=
 * wrapping invite= or a landing URL, plus email `link=` and short
 * `ios-app://{id}/invite|{promo}/{code}` alternate links. An empty or
 * foreign `code=` does not hide a later `invite=` / `promo=`. A foreign https URL is not a
 * code (u=https://example.com); Proofpoint URL Defense and Outlook
 * Safe Links wrapping a RealUnit landing are unwrapped. og:title / twitter:title,
 * og:description, and og:image:alt / twitter:image:alt take the campaign
 * code from the request URL; names wait for lookup JS. Facebook
 * al:ios:url / al:android:url are the custom scheme; al:web:url is HTTPS.
 * al:android:class is the Flutter activity (swiss.realunit.app.MainActivity).
 * Twitter App Card twitter:app:url:* is the same custom scheme.
 */
export const APP_STORE_ID = '6759720010';
export const APP_NAME = 'RealUnit';
export const ANDROID_PACKAGE = 'swiss.realunit.app';
export const ANDROID_ACTIVITY = 'swiss.realunit.app.MainActivity';
export const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=swiss.realunit.app';

const INVISIBLE_CODE_CHARS = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

function unescapeFullwidthUrlChars(value) {
  return String(value)
    .replace(/[\u3000\uFF01-\uFF5E]/g, (ch) => {
      if (ch === '\u3000') return ' ';
      return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
    })
    .replace(/\u2044/g, '/')
    .replace(/\u2215/g, '/')
    .replace(/\u2236/g, ':')
    .replace(/\u3002/g, '.')
    .replace(/\uFF61/g, '.')
    .replace(/\u2024/g, '.')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F]/g, ' ')
    .replace(/[\u2010-\u2014\u2212\uFE58\uFE63]/g, '-');
}

function unwrapNestedCode(code) {
  const nested = /(?:invite|promo)\/([^/?#]+)/i.exec(code);
  return nested ? nested[1] : code;
}

function capCode(raw) {
  if (raw == null) return null;
  let code = unescapeFullwidthUrlChars(String(raw));
  code = code.replace(INVISIBLE_CODE_CHARS, '').replace(/\s+/gu, '');
  if (!code) return null;
  // Same order as the API sanitizeReferralCode: unwrap before decode so
  // invite/AB%2F12 stays AB/12, then again after so %2Finvite%2FAB12CD works.
  code = unwrapNestedCode(code);
  try {
    code = decodeURIComponent(code);
  } catch {
    // keep the raw value when it is not valid percent-encoding
  }
  code = unescapeFullwidthUrlChars(code);
  code = code.replace(INVISIBLE_CODE_CHARS, '').replace(/\s+/gu, '');
  code = unwrapNestedCode(code);
  if (!code) return null;
  // Same fold as the API sanitizeReferralCode (uppercase, drop trailing punct, max 32).
  code = code.toUpperCase().replace(/[.?#&,;!/]+$/g, '');
  if (!code) return null;
  if (code.length > 32) code = code.slice(0, 32);
  // capCode of a leftover URL is never a programme token.
  if (code.indexOf('://') !== -1) return null;
  return code;
}

export function shouldRewriteItunesBanner(pathname) {
  const path = String(pathname || '');
  if (/\.(js|css|map|png|svg|json|jpg|jpeg|webp|ico|txt|xml)$/i.test(path)) {
    return false;
  }
  return (
    path === '/invite' ||
    path.startsWith('/invite/') ||
    path === '/promo' ||
    path.startsWith('/promo/')
  );
}

// Proofpoint URL Defense v2 encodes : as -3A and / as _ (same as invite-core).
function urlDefenseDecode(value) {
  const lower = String(value).toLowerCase();
  if (lower.indexOf('realunit.app/') !== -1 || lower.indexOf('realunit.app?') !== -1) {
    return null;
  }
  if (lower.indexOf('realunit') === -1) return null;
  if (value.indexOf('-') === -1 && value.indexOf('_') === -1) return null;
  const decoded = String(value)
    .replace(/-([0-9A-Fa-f]{2})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      if (code < 32 || code > 126) return _;
      return String.fromCharCode(code);
    })
    .replace(/_/g, '/');
  if (decoded === value) return null;
  if (decoded.toLowerCase().indexOf('realunit.app') === -1) return null;
  return decoded;
}

function embeddedRealunitLanding(text) {
  const value = String(text);
  const https = value.match(
    /https?:\/\/(?:www\.|dev\.)?realunit\.app(?=[/?#]|$)(?:\/(?:invite|promo)(?:\/[^\s<>#?&]*)?)?(?:[?#][^\s<>]*)?/i,
  );
  if (https) return https[0];
  const host = value.match(/(?:www\.|dev\.)?realunit\.app\/(?:invite|promo)\/[^\s<>?#&]*/i);
  if (host) return host[0];
  const wallet = value.match(
    /realunit-wallet:(?:\/\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?(?:[?#][^\s<>]*)?/i,
  );
  if (wallet) return wallet[0];
  const android = value.match(
    /android-app:\/\/swiss\.realunit\.app\/https\/(?:www\.|dev\.)?realunit\.app\/(?:invite|promo)(?:\/[^\s<>#?]*)?/i,
  );
  if (android) return android[0];
  const intent = value.match(
    /intent:\/\/(?:(?:www\.|dev\.)?realunit\.app\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?/i,
  );
  if (intent) return intent[0];
  const iosApp = value.match(
    /ios-app:\/\/\d+\/(?:realunit-wallet\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?/i,
  );
  if (iosApp) return iosApp[0];
  return null;
}

function looksLikeUrlValue(text) {
  return /^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(String(text).trim());
}

function isRealUnitHostName(host) {
  const h = String(host || '').toLowerCase();
  return h === 'realunit.app' || h === 'www.realunit.app' || h === 'dev.realunit.app';
}

const WRAPPER_QUERY_KEYS = ['utm_content', 'referrer', 'u', 'q', 'url', 'link'];
const CODE_QUERY_KEYS = ['code', 'invite', 'promo', 'app-argument'];

// Same contract as invite-core codeFromWrappedQueryValue: a RealUnit landing
// or invite=/promo=/code=, never a foreign https URL or a campaign name.
function codeFromYahooRu(value, depth) {
  const match = /RU=(https?(?::|%3A)(?:\/|%2F){2}[^&\s]+)/i.exec(value);
  if (!match) return null;
  let inner = match[1].replace(/\/RK=.*$/i, '');
  try {
    inner = decodeURIComponent(inner);
  } catch {
    // keep the captured value
  }
  inner = inner.replace(/(https?:)\/(?!\/)/i, '$1//');
  if (!/realunit\.app/i.test(inner)) return null;
  return codeFromWrappedLanding(inner, depth + 1);
}

function codeFromWrappedLanding(raw, depth) {
  if (raw == null || raw === '' || depth > 3) return null;
  const text = String(raw);

  const fromYahoo = codeFromYahooRu(text, depth);
  if (fromYahoo) return fromYahoo;

  // Wrapper query params first so Proofpoint `&d=` is not glued onto the code.
  try {
    const uri = new URL(text);
    const keys = WRAPPER_QUERY_KEYS;
    for (let i = 0; i < keys.length; i++) {
      const val = uri.searchParams.get(keys[i]);
      if (!val) continue;
      const from = codeFromWrappedLanding(val, depth + 1);
      if (from) return from;
    }
    if (isRealUnitHostName(uri.hostname)) {
      const segs = uri.pathname.split('/').filter(Boolean);
      if (
        segs.length >= 2 &&
        /^(invite|promo)$/i.test(segs[0]) &&
        segs[1].toLowerCase() !== 'index.html'
      ) {
        const fromSeg = capCode(segs[1]);
        if (fromSeg) return fromSeg;
      }
      // Try each code key — a foreign `code=` must not hide a later `invite=`.
      const fromNested = codeFromCodeQueryParams(uri.searchParams, depth + 1);
      if (fromNested) return fromNested;
      if (uri.hash && uri.hash.length > 1 && segs.length <= 1) {
        const fromHash = codeFromQueryCode(uri.hash.replace(/^#/, ''), depth + 1);
        if (fromHash) return fromHash;
      }
    }
    if (
      uri.pathname &&
      uri.pathname.length > 1 &&
      /realunit\.app|realunit-wallet/i.test(uri.pathname)
    ) {
      const fromPath = codeFromWrappedLanding(uri.pathname, depth + 1);
      if (fromPath) return fromPath;
    }
  } catch {
    // not an absolute URL
  }

  const defense = urlDefenseDecode(text);
  if (defense) {
    const fromDefense = codeFromWrappedLanding(defense, depth + 1);
    if (fromDefense) return fromDefense;
  }

  const embedded = embeddedRealunitLanding(text);
  if (embedded) {
    const code = capCode(embedded);
    if (code) return code;
  }

  if (!looksLikeUrlValue(text) && /(?:^|\/)(invite|promo)\//i.test(text)) {
    const code = capCode(text);
    if (code) return code;
  }

  let qs = text.charAt(0) === '?' ? text.slice(1) : text;
  if (
    /^(invite|promo|code)=/i.test(qs) ||
    (qs.indexOf('&') !== -1 && /(^|&)(invite|promo|code)=/i.test(qs))
  ) {
    const params = new URLSearchParams(qs);
    const innerKeys = ['invite', 'promo', 'code'];
    for (let i = 0; i < innerKeys.length; i++) {
      const inner = params.get(innerKeys[i]);
      if (!inner) continue;
      const fromInner = codeFromWrappedLanding(inner, depth + 1);
      if (fromInner) return fromInner;
      if (!looksLikeUrlValue(inner)) {
        const code = capCode(inner);
        if (code) return code;
      }
    }
  }

  return null;
}

function codeFromUtmOrReferrer(raw) {
  return codeFromWrappedLanding(raw, 0);
}

function codeFromWrapperQueryParams(params) {
  for (let i = 0; i < WRAPPER_QUERY_KEYS.length; i++) {
    const val = params.get(WRAPPER_QUERY_KEYS[i]);
    if (!val) continue;
    const code = codeFromUtmOrReferrer(val);
    if (code) return code;
  }
  return null;
}

function codeFromCodeQueryParams(params, depth) {
  for (let i = 0; i < CODE_QUERY_KEYS.length; i++) {
    const val = params.get(CODE_QUERY_KEYS[i]);
    if (!val) continue;
    const code = codeFromQueryCode(val, depth);
    if (code) return code;
  }
  return null;
}

function codeFromQueryCode(raw, depth) {
  if (raw == null || raw === '') return null;
  const wrapped = codeFromWrappedLanding(raw, depth == null ? 0 : depth);
  if (wrapped) return wrapped;
  if (looksLikeUrlValue(raw)) return null;
  return capCode(raw);
}

export function parseLandingFromUrl(urlLike) {
  let url;
  try {
    url = new URL(urlLike, 'https://realunit.app');
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  const kind = (parts[0] || '').toLowerCase();
  if (kind !== 'invite' && kind !== 'promo') return null;
  const segment = parts[1];
  if (segment && /\.(js|css|map|png|svg|json|html)$/i.test(segment)) {
    return { kind, code: null };
  }
  let code = segment && segment.toLowerCase() !== 'index.html' ? capCode(segment) : null;
  if (!code) {
    code = codeFromCodeQueryParams(url.searchParams);
  }
  if (!code) {
    code = codeFromWrapperQueryParams(url.searchParams);
  }
  if (!code && url.hash) {
    code = codeFromQueryCode(url.hash.replace(/^#/, ''));
  }
  return { kind, code };
}

export function itunesBanner(kind, code) {
  let banner = 'app-id=' + APP_STORE_ID;
  if (kind && code) {
    banner += ', app-argument=realunit-wallet://' + kind + '/' + encodeURIComponent(code);
  }
  return banner;
}

export function injectItunesBannerHtml(html, bannerContent) {
  if (typeof html !== 'string' || html.indexOf('apple-itunes-app') === -1) {
    return html;
  }
  const content = String(bannerContent);
  const named = html.replace(
    /(<meta\b[^>]*\bname=["']apple-itunes-app["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    '$1' + content + '$3',
  );
  if (named !== html) return named;
  return html.replace(
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']apple-itunes-app["'][^>]*>)/i,
    '$1' + content + '$3',
  );
}

export function injectItunesBannerFromRequestUrl(html, urlLike) {
  return injectLandingFromRequestUrl(html, urlLike);
}

export function canonicalOrigin(host) {
  if (host === 'dev.realunit.app') return 'https://dev.realunit.app';
  if (host === 'realunit.app' || host === 'www.realunit.app') return 'https://realunit.app';
  return null;
}

export function requestOrigin(urlLike) {
  try {
    const url = new URL(urlLike, 'https://realunit.app');
    return canonicalOrigin(url.hostname) || url.origin;
  } catch {
    return 'https://realunit.app';
  }
}

export function canonicalLandingHref(urlLike) {
  const parsed = parseLandingFromUrl(urlLike);
  if (!parsed) return null;
  let path = '/' + parsed.kind;
  if (parsed.code) path += '/' + encodeURIComponent(parsed.code);
  return requestOrigin(urlLike) + path;
}

function replaceTaggedAttr(html, namedRe, flippedRe, value) {
  const named = html.replace(namedRe, '$1' + value + '$3');
  if (named !== html) return named;
  return html.replace(flippedRe, '$1' + value + '$3');
}

export function injectLandingCanonicalHtml(html, href) {
  if (typeof html !== 'string' || !href) return html;
  let out = replaceTaggedAttr(
    html,
    /(<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:url["'][^>]*>)/i,
    href,
  );
  out = replaceTaggedAttr(
    out,
    /(<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["'])([^"']*)(["'][^>]*>)/i,
    /(<link\b[^>]*\bhref=["'])([^"']*)(["'][^>]*\brel=["']canonical["'][^>]*>)/i,
    href,
  );
  return replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bname=["']twitter:url["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:url["'][^>]*>)/i,
    href,
  );
}

export function parseLangFromUrl(urlLike) {
  try {
    const raw = String(new URL(urlLike, 'https://realunit.app').searchParams.get('lang') || '')
      .slice(0, 2)
      .toLowerCase();
    if (raw === 'en' || raw === 'de') return raw;
    return null;
  } catch {
    return null;
  }
}

/** Crawlers snapshot og:title / twitter:title from the HTML bytes. Names wait for lookup JS. */
export function shareTitle(kind, code, lang) {
  if (!kind || !code) return null;
  if (lang === 'en') {
    return kind === 'promo' ? 'RealUnit — Promo code ' + code : 'RealUnit — Invitation ' + code;
  }
  return kind === 'promo' ? 'RealUnit — Promo-Code ' + code : 'RealUnit — Einladung ' + code;
}

export function injectShareTitleHtml(html, kind, code, lang) {
  if (typeof html !== 'string') return html;
  const title = shareTitle(kind, code, lang);
  if (!title) return html;
  let out = replaceTaggedAttr(
    html,
    /(<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:title["'][^>]*>)/i,
    title,
  );
  out = replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bname=["']twitter:title["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:title["'][^>]*>)/i,
    title,
  );
  return out.replace(/<title>[^<]*<\/title>/i, '<title>' + title + '</title>');
}

/** Crawlers snapshot og:image:alt / twitter:image:alt from the HTML bytes. */
export function injectShareImageAltHtml(html, kind, code, lang) {
  if (typeof html !== 'string') return html;
  const alt = shareTitle(kind, code, lang);
  if (!alt) return html;
  let out = replaceTaggedAttr(
    html,
    /(<meta\b[^>]*\bproperty=["']og:image:alt["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:image:alt["'][^>]*>)/i,
    alt,
  );
  return replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bname=["']twitter:image:alt["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:image:alt["'][^>]*>)/i,
    alt,
  );
}

/** Crawlers snapshot og:description from the HTML bytes. Names wait for lookup JS. */
export function shareDescription(code, lang) {
  if (!code) return null;
  if (lang === 'en') return 'Open the RealUnit app with code ' + code + '.';
  return 'Öffne die RealUnit-App mit dem Code ' + code + '.';
}

export function injectShareDescriptionHtml(html, code, lang) {
  if (typeof html !== 'string') return html;
  const description = shareDescription(code, lang);
  if (!description) return html;
  let out = replaceTaggedAttr(
    html,
    /(<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:description["'][^>]*>)/i,
    description,
  );
  out = replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bname=["']twitter:description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:description["'][^>]*>)/i,
    description,
  );
  return replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']description["'][^>]*>)/i,
    description,
  );
}

// Crawlers (iMessage, WhatsApp) snapshot og:url / canonical from the HTML
// bytes. Keep mock query params off the canonical path.
export function playStoreUrl(code, kind) {
  if (code) {
    const key = kind === 'promo' ? 'promo' : 'invite';
    return PLAY_STORE_BASE + '&referrer=' + encodeURIComponent(key + '=' + code);
  }
  return PLAY_STORE_BASE;
}

export function androidAppUrl(kind, code) {
  return (
    'android-app://swiss.realunit.app/https/realunit.app/' + kind + '/' + encodeURIComponent(code)
  );
}

export function iosAppUrl(kind, code) {
  return 'ios-app://' + APP_STORE_ID + '/realunit-wallet/' + kind + '/' + encodeURIComponent(code);
}

function upsertAlternate(html, dataAttr, href) {
  const named = new RegExp(
    `(<link\\b[^>]*\\b${dataAttr}\\b[^>]*\\bhref=["'])([^"']*)(["'][^>]*>)`,
    'i',
  );
  if (named.test(html)) return html.replace(named, '$1' + href + '$3');
  const flipped = new RegExp(
    `(<link\\b[^>]*\\bhref=["'])([^"']*)(["'][^>]*\\b${dataAttr}\\b[^>]*>)`,
    'i',
  );
  if (flipped.test(html)) return html.replace(flipped, '$1' + href + '$3');
  const tag = `<link rel="alternate" ${dataAttr} href="${href}" />`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '\n</head>');
  return html + tag;
}

function upsertMeta(html, keyAttr, key, content) {
  const named = new RegExp(
    `(<meta\\b[^>]*\\b${keyAttr}=["']${key}["'][^>]*\\bcontent=["'])([^"']*)(["'][^>]*>)`,
    'i',
  );
  if (named.test(html)) return html.replace(named, '$1' + content + '$3');
  const flipped = new RegExp(
    `(<meta\\b[^>]*\\bcontent=["'])([^"']*)(["'][^>]*\\b${keyAttr}=["']${key}["'][^>]*>)`,
    'i',
  );
  if (flipped.test(html)) return html.replace(flipped, '$1' + content + '$3');
  const tag = `<meta ${keyAttr}="${key}" content="${content}" />`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '\n</head>');
  return html + tag;
}

export function appLink(kind, code) {
  return 'realunit-wallet://' + kind + '/' + encodeURIComponent(code);
}

// X / Twitter snapshots twitter:app:* from the HTML bytes (Offerte Punkt 3).
// twitter:app:url:* is the custom scheme so a tweet opens the app.
export function injectTwitterAppHtml(html, kind, code) {
  if (typeof html !== 'string' || !kind || !code) return html;
  const scheme = appLink(kind, code);
  let out = upsertMeta(html, 'name', 'twitter:app:name:iphone', APP_NAME);
  out = upsertMeta(out, 'name', 'twitter:app:id:iphone', APP_STORE_ID);
  out = upsertMeta(out, 'name', 'twitter:app:url:iphone', scheme);
  out = upsertMeta(out, 'name', 'twitter:app:name:ipad', APP_NAME);
  out = upsertMeta(out, 'name', 'twitter:app:id:ipad', APP_STORE_ID);
  out = upsertMeta(out, 'name', 'twitter:app:url:ipad', scheme);
  out = upsertMeta(out, 'name', 'twitter:app:name:googleplay', APP_NAME);
  out = upsertMeta(out, 'name', 'twitter:app:id:googleplay', ANDROID_PACKAGE);
  out = upsertMeta(out, 'name', 'twitter:app:url:googleplay', scheme);
  return upsertMeta(out, 'name', 'twitter:app:country', 'CH');
}

// WhatsApp / Facebook snapshot al:* App Links from the HTML bytes.
// al:ios:url and al:android:url are the custom scheme so a share opens
// the app; al:web:url is the HTTPS landing (Offerte Punkt 3).
export function injectShareAppLinksHtml(html, kind, code, href) {
  if (typeof html !== 'string' || !kind || !code || !href) return html;
  const scheme = appLink(kind, code);
  let out = upsertMeta(html, 'property', 'al:ios:url', scheme);
  out = upsertMeta(out, 'property', 'al:ios:app_store_id', APP_STORE_ID);
  out = upsertMeta(out, 'property', 'al:ios:app_name', APP_NAME);
  out = upsertMeta(out, 'property', 'al:android:url', scheme);
  out = upsertMeta(out, 'property', 'al:android:package', ANDROID_PACKAGE);
  out = upsertMeta(out, 'property', 'al:android:class', ANDROID_ACTIVITY);
  out = upsertMeta(out, 'property', 'al:android:app_name', APP_NAME);
  out = upsertMeta(out, 'property', 'al:web:url', href);
  return injectTwitterAppHtml(out, kind, code);
}

export function injectInstallHandoffHtml(html, kind, code) {
  if (typeof html !== 'string' || !kind || !code) return html;
  let out = replaceTaggedAttr(
    html,
    /(<a\b[^>]*\bdata-store=["']play["'][^>]*\bhref=["'])([^"']*)(["'][^>]*>)/i,
    /(<a\b[^>]*\bhref=["'])([^"']*)(["'][^>]*\bdata-store=["']play["'][^>]*>)/i,
    playStoreUrl(code, kind),
  );
  out = upsertAlternate(out, 'data-android-app', androidAppUrl(kind, code));
  return upsertAlternate(out, 'data-ios-app', iosAppUrl(kind, code));
}

/** Crawlers snapshot html lang / og:locale from the HTML bytes. */
export function injectShareLocaleHtml(html, lang) {
  if (typeof html !== 'string' || lang !== 'en') return html;
  let out = html.replace(/<html\b([^>]*)\blang=["'][^"']*["']/i, '<html$1lang="en"');
  out = replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bproperty=["']og:locale["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:locale["'][^>]*>)/i,
    'en_GB',
  );
  return replaceTaggedAttr(
    out,
    /(<meta\b[^>]*\bproperty=["']og:locale:alternate["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
    /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:locale:alternate["'][^>]*>)/i,
    'de_CH',
  );
}

/** Crawlers snapshot og:site_name from the HTML bytes. Brand stays RealUnit. */
export function injectSiteNameHtml(html) {
  if (typeof html !== 'string') return html;
  return upsertMeta(html, 'property', 'og:site_name', APP_NAME);
}

export function injectLandingFromRequestUrl(html, urlLike) {
  const parsed = parseLandingFromUrl(urlLike);
  const lang = parseLangFromUrl(urlLike);
  let out = injectItunesBannerHtml(
    html,
    itunesBanner(parsed && parsed.kind, parsed && parsed.code),
  );
  const href = canonicalLandingHref(urlLike);
  out = injectLandingCanonicalHtml(out, href);
  out = injectShareTitleHtml(out, parsed && parsed.kind, parsed && parsed.code, lang);
  out = injectShareImageAltHtml(out, parsed && parsed.kind, parsed && parsed.code, lang);
  out = injectShareDescriptionHtml(out, parsed && parsed.code, lang);
  out = injectShareLocaleHtml(out, lang);
  out = injectSiteNameHtml(out);
  out = injectInstallHandoffHtml(out, parsed && parsed.kind, parsed && parsed.code);
  return injectShareAppLinksHtml(out, parsed && parsed.kind, parsed && parsed.code, href);
}
