import '../public/js/lib/invite-core.js';
import { describe, expect, test } from 'vitest';
import {
  APP_STORE_ID,
  canonicalLandingHref,
  injectLandingCanonicalHtml,
  requestOrigin,
  injectItunesBannerFromRequestUrl,
  injectItunesBannerHtml,
  injectLandingFromRequestUrl,
  injectInstallHandoffHtml,
  injectShareAppLinksHtml,
  injectTwitterAppHtml,
  injectShareTitleHtml,
  injectShareImageAltHtml,
  shareTitle,
  injectShareDescriptionHtml,
  shareDescription,
  parseLangFromUrl,
  injectShareLocaleHtml,
  injectSiteNameHtml,
  playStoreUrl,
  itunesBanner,
  parseLandingFromUrl,
  shouldRewriteItunesBanner,
} from '../functions/lib/itunes-banner.js';

const META = '<meta name="apple-itunes-app" content="app-id=6759720010" />';
const META_FLIPPED = '<meta content="app-id=6759720010" name="apple-itunes-app" />';

describe('shouldRewriteItunesBanner', () => {
  test('invite and promo HTML paths only', () => {
    expect(shouldRewriteItunesBanner('/invite')).toBe(true);
    expect(shouldRewriteItunesBanner('/invite/AB12CD')).toBe(true);
    expect(shouldRewriteItunesBanner('/promo/EVT1')).toBe(true);
    expect(shouldRewriteItunesBanner('/invite/invite.js')).toBe(false);
    expect(shouldRewriteItunesBanner('/js/invite-banner.js')).toBe(false);
    expect(shouldRewriteItunesBanner('/')).toBe(false);
    expect(shouldRewriteItunesBanner('/.well-known/apple-app-site-association')).toBe(false);
  });
});

describe('parseLandingFromUrl', () => {
  test('path, query, hash, and nested URL', () => {
    expect(parseLandingFromUrl('https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/ab12cd')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://www.realunit.app/promo/EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite?code=AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?code=https://example.com&invite=AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=' +
          encodeURIComponent('https://realunit.app/invite?code=https://example.com&invite=AB12CD'),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=' +
          encodeURIComponent('code=https://example.com&invite=AB12CD'),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?referrer=' +
          encodeURIComponent('invite=https://example.com&promo=EVT1'),
      ),
    ).toEqual({ kind: 'invite', code: 'EVT1' });
    expect(parseLandingFromUrl('https://realunit.app/promo?code=&promo=EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite?utm_content=invite%3DAB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_source=google-play&utm_content=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=' +
          encodeURIComponent('https://realunit.app/invite?code=AB12CD'),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?utm_content=realunit.app/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseLandingFromUrl('https://realunit.app/invite?utm_content=/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite?code=invite%2FAB%252F12')).toEqual({
      kind: 'invite',
      code: 'AB/12',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite?code=%2Finvite%2FAB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseLandingFromUrl('https://realunit.app/promo?referrer=promo%3DEVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite?utm_content=summer-sale')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=summer-sale&u=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=summer-sale&link=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?u=https://realunit.app/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?q=https://realunit.app/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?url=https://realunit.app/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseLandingFromUrl('https://realunit.app/invite?u=hello')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?link=https://realunit.app/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseLandingFromUrl('https://realunit.app/invite?link=hello')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=ios-app://6759720010/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=ios-app://6759720010/realunit-wallet/promo/EVT1',
      ),
    ).toEqual({ kind: 'invite', code: 'EVT1' });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?utm_content=https://example.com/campaign'),
    ).toEqual({ kind: 'invite', code: null });
    expect(
      parseLandingFromUrl('https://realunit.app/invite?u=https://example.com/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: null });
    expect(parseLandingFromUrl('https://realunit.app/invite?code=https://example.com/foo')).toEqual(
      { kind: 'invite', code: null },
    );
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=' +
          encodeURIComponent(
            'https://urldefense.proofpoint.com/v2/url?u=https-3A__realunit.app_invite_AB12CD&d=Dw',
          ),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?url=' +
          encodeURIComponent(
            'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD&data=05',
          ),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite?utm_content=https://www.google.com/amp/s/realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/promo?q=' +
          encodeURIComponent(
            'https://r.search.yahoo.com/_ylt=x/RU=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1/RK=2',
          ),
      ),
    ).toEqual({ kind: 'promo', code: 'EVT1' });
    expect(parseLandingFromUrl('https://realunit.app/invite/AB12CD?utm_content=OTHER')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite#AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite/' + encodeURIComponent('https://realunit.app/promo/EVT1'),
      ),
    ).toEqual({ kind: 'invite', code: 'EVT1' });
    expect(parseLandingFromUrl('https://realunit.app/invite')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/index.html')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(parseLandingFromUrl('/invite/AB12CD?mock=1')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/%')).toEqual({
      kind: 'invite',
      code: '%',
    });
    const long = 'A'.repeat(300);
    expect(parseLandingFromUrl('https://realunit.app/invite/' + long).code).toHaveLength(32);
    expect(parseLandingFromUrl('https://realunit.app/invite/AB12CD!')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/AB12CD!?')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/promo/EVT1.')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/AB\u200B12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/AB%E2%80%8B12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/ＡＢ１２ＣＤ')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseLandingFromUrl(
        'https://realunit.app/invite/%EF%BC%A1%EF%BC%A2%EF%BC%91%EF%BC%92%EF%BC%A3%EF%BC%A4',
      ),
    ).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseLandingFromUrl('https://realunit.app/promo/\uFEFFEVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseLandingFromUrl('https://realunit.app/invite/!')).toEqual({
      kind: 'invite',
      code: null,
    });
    expect(parseLandingFromUrl('https://realunit.app/')).toBeNull();
    expect(parseLandingFromUrl('http://[')).toBeNull();
  });
});

describe('injectItunesBannerHtml', () => {
  test('replaces both attribute orders and leaves other HTML alone', () => {
    expect(injectItunesBannerHtml(META, itunesBanner('invite', 'AB12CD'))).toBe(
      '<meta name="apple-itunes-app" content="app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD" />',
    );
    expect(injectItunesBannerHtml(META_FLIPPED, itunesBanner('promo', 'EVT1'))).toBe(
      '<meta content="app-id=6759720010, app-argument=realunit-wallet://promo/EVT1" name="apple-itunes-app" />',
    );
    expect(injectItunesBannerHtml('<p>no meta</p>', itunesBanner('invite', 'AB12CD'))).toBe(
      '<p>no meta</p>',
    );
    expect(injectItunesBannerHtml(null, itunesBanner('invite', 'AB12CD'))).toBeNull();
  });
});

describe('injectItunesBannerFromRequestUrl', () => {
  test('matches invite-core for canonical invite and promo URLs', () => {
    const core = window.RealUnitInvite;
    const invite = injectItunesBannerFromRequestUrl(META, 'https://realunit.app/invite/AB12CD');
    expect(invite).toContain(core.injectItunesBannerHtml(META, '/invite/AB12CD', '', ''));
    expect(invite).toContain('app-argument=realunit-wallet://invite/AB12CD');
    const promo = injectItunesBannerFromRequestUrl(META, 'https://dev.realunit.app/promo/EVT1');
    expect(promo).toContain(core.injectItunesBannerHtml(META, '/promo/EVT1', '', ''));
    expect(promo).toContain('app-argument=realunit-wallet://promo/EVT1');
    const bare = injectItunesBannerFromRequestUrl(META, 'https://realunit.app/invite');
    expect(bare).toContain('content="app-id=' + APP_STORE_ID + '"');
    expect(bare).toContain('property="og:site_name" content="RealUnit"');
    expect(bare).not.toContain('app-argument=');
    const fromUtm = injectItunesBannerFromRequestUrl(
      META,
      'https://realunit.app/invite?utm_content=invite%3DAB12CD',
    );
    expect(fromUtm).toContain('app-argument=realunit-wallet://invite/AB12CD');
    const fromFacebookU = injectItunesBannerFromRequestUrl(
      META,
      'https://realunit.app/invite?u=https://realunit.app/invite/AB12CD',
    );
    expect(fromFacebookU).toContain('app-argument=realunit-wallet://invite/AB12CD');
  });
});

describe('canonicalLandingHref', () => {
  test('folds www onto the apex and drops mock query', () => {
    expect(canonicalLandingHref('https://www.realunit.app/invite/AB12CD?mock=1')).toBe(
      'https://realunit.app/invite/AB12CD',
    );
    expect(canonicalLandingHref('https://realunit.app/invite?utm_content=invite%3DAB12CD')).toBe(
      'https://realunit.app/invite/AB12CD',
    );
    expect(canonicalLandingHref('https://dev.realunit.app/promo/EVT1')).toBe(
      'https://dev.realunit.app/promo/EVT1',
    );
    expect(canonicalLandingHref('http://127.0.0.1:4173/invite/AB12CD?mock=1')).toBe(
      'http://127.0.0.1:4173/invite/AB12CD',
    );
    expect(canonicalLandingHref('https://realunit.app/')).toBeNull();
    expect(canonicalLandingHref('http://[')).toBeNull();
    expect(requestOrigin('http://[')).toBe('https://realunit.app');
    expect(injectLandingCanonicalHtml('<p>x</p>', null)).toBe('<p>x</p>');
    expect(injectLandingCanonicalHtml(null, 'https://realunit.app/invite/AB12CD')).toBeNull();
  });
});

describe('injectLandingFromRequestUrl', () => {
  test('sets banner, og:url, and canonical together', () => {
    const shell =
      META +
      '<meta property="og:url" content="https://realunit.app/invite/" />' +
      '<link rel="canonical" href="https://realunit.app/invite/" />' +
      '<meta name="twitter:url" content="https://realunit.app/invite/" />' +
      '<meta property="og:title" content="RealUnit — Einladung" />' +
      '<meta name="twitter:title" content="RealUnit — Einladung" />' +
      '<meta property="og:image:alt" content="RealUnit" />' +
      '<meta name="twitter:image:alt" content="RealUnit" />' +
      '<meta property="og:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="twitter:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="description" content="Öffne die RealUnit-App mit diesem Code." />';
    const out = injectLandingFromRequestUrl(shell, 'https://www.realunit.app/invite/AB12CD?mock=1');
    expect(out).toContain('app-argument=realunit-wallet://invite/AB12CD');
    expect(out).toContain('content="https://realunit.app/invite/AB12CD"');
    expect(out).toContain('href="https://realunit.app/invite/AB12CD"');
    expect(out).toContain('name="twitter:url" content="https://realunit.app/invite/AB12CD"');
    expect(out).toContain('property="og:title" content="RealUnit — Einladung AB12CD"');
    expect(out).toContain('property="og:image:alt" content="RealUnit — Einladung AB12CD"');
    expect(out).toContain('name="twitter:image:alt" content="RealUnit — Einladung AB12CD"');
    expect(out).toContain(
      'property="og:description" content="Öffne die RealUnit-App mit dem Code AB12CD."',
    );
    expect(out).toContain('property="al:ios:url" content="realunit-wallet://invite/AB12CD"');
    expect(out).toContain(
      'name="twitter:app:url:iphone" content="realunit-wallet://invite/AB12CD"',
    );
    expect(out).toContain('property="og:site_name" content="RealUnit"');
    const nope = injectLandingFromRequestUrl('<p>nope</p>', 'https://realunit.app/invite/AB12CD');
    expect(nope).toContain('<p>nope</p>');
    expect(nope).toContain('data-android-app');
    expect(nope).toContain('al:ios:url');
  });

  test('sets Play referrer and alternate links from the request URL', () => {
    const shell =
      '<head></head><a data-store="play" href="https://play.google.com/store/apps/details?id=swiss.realunit.app">Play</a>';
    const out = injectLandingFromRequestUrl(shell, 'https://realunit.app/invite/AB12CD');
    expect(out).toContain(playStoreUrl('AB12CD', 'invite'));
    expect(out).toContain('data-android-app');
    expect(out).toContain('data-ios-app');
    expect(out).toContain('al:android:url');
    expect(out).toContain('property="al:android:url" content="realunit-wallet://invite/AB12CD"');
    expect(out).toContain('property="al:android:class" content="swiss.realunit.app.MainActivity"');
    expect(out).toContain('property="al:web:url" content="https://realunit.app/invite/AB12CD"');
    expect(out).toContain(
      'name="twitter:app:url:iphone" content="realunit-wallet://invite/AB12CD"',
    );
    expect(out).toContain(
      'name="twitter:app:url:googleplay" content="realunit-wallet://invite/AB12CD"',
    );
    expect(out).toContain('name="twitter:app:id:iphone" content="6759720010"');
    expect(out).toContain('name="twitter:app:id:googleplay" content="swiss.realunit.app"');
    expect(out).toContain('name="twitter:app:country" content="CH"');
    expect(out).toContain('property="og:site_name" content="RealUnit"');
    expect(injectSiteNameHtml('<head></head>')).toContain(
      'property="og:site_name" content="RealUnit"',
    );
    expect(injectSiteNameHtml(null)).toBeNull();
    expect(injectTwitterAppHtml('<head></head>', 'invite', 'AB12CD')).toContain(
      'name="twitter:app:url:iphone" content="realunit-wallet://invite/AB12CD"',
    );
    expect(injectTwitterAppHtml(shell, 'invite', null)).toBe(shell);
    expect(injectTwitterAppHtml(null, 'invite', 'AB12CD')).toBeNull();
    expect(injectInstallHandoffHtml(shell, 'invite', null)).toBe(shell);
    expect(
      injectShareAppLinksHtml(shell, 'invite', null, 'https://realunit.app/invite/AB12CD'),
    ).toBe(shell);
  });

  test('injectShareTitleHtml writes og:title from the campaign code', () => {
    const shell =
      '<meta property="og:title" content="RealUnit — Einladung" />' +
      '<meta name="twitter:title" content="RealUnit — Einladung" />';
    expect(injectShareTitleHtml(shell, 'invite', 'AB12CD')).toContain(
      'content="RealUnit — Einladung AB12CD"',
    );
    expect(injectShareTitleHtml(shell, 'promo', 'EVT1')).toContain(
      'content="RealUnit — Promo-Code EVT1"',
    );
    expect(injectShareTitleHtml(shell, 'invite', null)).toBe(shell);
    expect(injectShareTitleHtml(null, 'invite', 'AB12CD')).toBeNull();
    expect(shareTitle('invite', 'AB12CD')).toBe('RealUnit — Einladung AB12CD');
    expect(shareTitle('invite', 'AB12CD', 'en')).toBe('RealUnit — Invitation AB12CD');
    expect(shareTitle('promo', 'EVT1', 'en')).toBe('RealUnit — Promo code EVT1');
    expect(shareTitle(null, 'AB12CD')).toBeNull();
  });

  test('injectShareImageAltHtml writes og:image:alt from the campaign code', () => {
    const shell =
      '<meta property="og:image:alt" content="RealUnit" />' +
      '<meta name="twitter:image:alt" content="RealUnit" />';
    expect(injectShareImageAltHtml(shell, 'invite', 'AB12CD')).toContain(
      'content="RealUnit — Einladung AB12CD"',
    );
    expect(injectShareImageAltHtml(shell, 'promo', 'EVT1', 'en')).toContain(
      'content="RealUnit — Promo code EVT1"',
    );
    expect(
      injectShareImageAltHtml(
        '<meta content="RealUnit" property="og:image:alt">' +
          '<meta content="RealUnit" name="twitter:image:alt">',
        'invite',
        'AB12CD',
      ),
    ).toContain('content="RealUnit — Einladung AB12CD"');
    expect(injectShareImageAltHtml(shell, 'invite', null)).toBe(shell);
    expect(injectShareImageAltHtml(null, 'invite', 'AB12CD')).toBeNull();
  });

  test('injectShareDescriptionHtml writes og:description from the campaign code', () => {
    const shell =
      '<meta property="og:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="twitter:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="description" content="Öffne die RealUnit-App mit diesem Code." />';
    expect(injectShareDescriptionHtml(shell, 'AB12CD')).toContain(
      'content="Öffne die RealUnit-App mit dem Code AB12CD."',
    );
    expect(injectShareDescriptionHtml(shell, 'AB12CD', 'en')).toContain(
      'content="Open the RealUnit app with code AB12CD."',
    );
    expect(injectShareDescriptionHtml(shell, null)).toBe(shell);
    expect(injectShareDescriptionHtml(null, 'AB12CD')).toBeNull();
    expect(shareDescription('EVT1')).toBe('Öffne die RealUnit-App mit dem Code EVT1.');
    expect(shareDescription('EVT1', 'en')).toBe('Open the RealUnit app with code EVT1.');
    expect(shareDescription(null)).toBeNull();
  });

  test('?lang=en sets html lang and og:locale before JS', () => {
    expect(parseLangFromUrl('https://realunit.app/invite/AB12CD?lang=en')).toBe('en');
    expect(parseLangFromUrl('https://realunit.app/invite/AB12CD')).toBeNull();
    const shell =
      '<html lang="de"><title>RealUnit — Einladung</title>' +
      '<meta property="og:title" content="RealUnit — Einladung" />' +
      '<meta property="og:image:alt" content="RealUnit" />' +
      '<meta property="og:locale" content="de_CH" />' +
      '<meta property="og:locale:alternate" content="en_GB" />' +
      '<meta property="og:description" content="Öffne die RealUnit-App mit diesem Code." />';
    const out = injectLandingFromRequestUrl(shell, 'https://realunit.app/invite/AB12CD?lang=en');
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('property="og:locale" content="en_GB"');
    expect(out).toContain('property="og:locale:alternate" content="de_CH"');
    expect(out).toContain('property="og:title" content="RealUnit — Invitation AB12CD"');
    expect(out).toContain('property="og:image:alt" content="RealUnit — Invitation AB12CD"');
    expect(out).toContain('<title>RealUnit — Invitation AB12CD</title>');
    expect(out).toContain('Open the RealUnit app with code AB12CD.');
    expect(injectShareLocaleHtml(shell, 'de')).toBe(shell);
    expect(injectShareLocaleHtml(shell, null)).toBe(shell);
  });
});
