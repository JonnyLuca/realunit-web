import '../public/js/lib/invite-core.js';
import { describe, expect, test } from 'vitest';

const core = window.RealUnitInvite;
const {
  SUPPORTED_LANGS,
  I18N,
  resolveLang,
  isRealUnitHost,
  canonicalOrigin,
  homeUrl,
  apiBase,
  parseCodeFromPath,
  parseCodeFromLocation,
  codeFromPastedReferralUrl,
  buildLookupUrl,
  appLink,
  appStoreUrl,
  itunesBanner,
  applyItunesBannerFromLocation,
  injectItunesBannerHtml,
  injectLandingCanonicalHtml,
  injectShareTitleHtml,
  injectShareImageAltHtml,
  shareTitle,
  injectShareDescriptionHtml,
  shareDescription,
  langFromSearch,
  injectShareLocaleHtml,
  injectSiteNameHtml,
  injectTwitterAppHtml,
  injectInstallHandoffHtml,
  injectShareAppLinksHtml,
  landingCanonicalHref,
  playStoreUrl,
  androidIntentUrl,
  openInAppUrl,
  androidAppUrl,
  iosAppUrl,
  interpolate,
  mapResult,
  promoBody,
  promoBodyLang,
  inviteBody,
  inviteBodyLang,
  LOOKUP_TIMEOUT_MS,
  COPY_TIMEOUT_MS,
  lookupFetchInit,
  finalizeLookup,
  keepLandingFocus,
} = core;

describe('resolveLang', () => {
  test('prefers supported ?lang=', () => {
    expect(
      resolveLang({
        urlLang: 'en',
        navigatorLang: 'de-DE',
        supported: SUPPORTED_LANGS,
        defaultLang: 'de',
      }),
    ).toBe('en');
  });

  test('falls back to default for unsupported ?lang= without consulting the browser', () => {
    expect(
      resolveLang({
        urlLang: 'pt',
        navigatorLang: 'en-US',
        supported: SUPPORTED_LANGS,
        defaultLang: 'de',
      }),
    ).toBe('de');
  });

  test('uses the browser when there is no ?lang=', () => {
    expect(
      resolveLang({
        urlLang: null,
        navigatorLang: 'en-GB',
        supported: SUPPORTED_LANGS,
        defaultLang: 'de',
      }),
    ).toBe('en');
  });

  test('treats a non-string as absent', () => {
    expect(
      resolveLang({
        urlLang: 12,
        navigatorLang: undefined,
        supported: SUPPORTED_LANGS,
        defaultLang: 'de',
      }),
    ).toBe('de');
  });
});

describe('hosts and API base', () => {
  test('recognises production and dev hosts only', () => {
    expect(isRealUnitHost('realunit.app')).toBe(true);
    expect(isRealUnitHost('localhost')).toBe(false);
  });

  test('canonicalOrigin folds www onto the apex', () => {
    expect(canonicalOrigin('realunit.app')).toBe('https://realunit.app');
    expect(canonicalOrigin('www.realunit.app')).toBe('https://realunit.app');
    expect(canonicalOrigin('dev.realunit.app')).toBe('https://dev.realunit.app');
    expect(canonicalOrigin('localhost')).toBeNull();
  });

  test('homeUrl folds www onto the apex and keeps / on local preview', () => {
    expect(homeUrl('realunit.app')).toBe('https://realunit.app/');
    expect(homeUrl('www.realunit.app')).toBe('https://realunit.app/');
    expect(homeUrl('dev.realunit.app')).toBe('https://dev.realunit.app/');
    expect(homeUrl('localhost')).toBe('/');
  });

  test('maps hosts to the DFX API', () => {
    expect(apiBase({ host: 'realunit.app' })).toBe('https://api.dfx.swiss');
    expect(apiBase({ host: 'www.realunit.app' })).toBe('https://api.dfx.swiss');
    expect(apiBase({ host: 'dev.realunit.app' })).toBe('https://dev.api.dfx.swiss');
    expect(apiBase({ host: 'localhost', paramApi: 'https://api.example.test' })).toBe(
      'https://api.example.test',
    );
    expect(apiBase({ host: 'localhost' })).toBe('https://dev.api.dfx.swiss');
  });
});

describe('parseCodeFromPath', () => {
  test('reads invite and promo codes', () => {
    expect(parseCodeFromPath('/invite/AB12CD')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/invite/ab12cd')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/invite/AB12CD/')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/promo/EVT1')).toEqual({ kind: 'promo', code: 'EVT1' });
    expect(parseCodeFromPath('/INVITE/AB12CD')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/invite/AB12CD/extra')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/PROMO/EVT1/extra')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
  });

  test('rejects incomplete or unknown paths', () => {
    expect(parseCodeFromPath('/invite/')).toBeNull();
    expect(parseCodeFromPath('/other/AB12CD')).toBeNull();
    expect(parseCodeFromPath(null)).toBeNull();
  });

  test('decodes a percent-encoded path segment', () => {
    expect(parseCodeFromPath('/invite/AB%2F12')).toEqual({
      kind: 'invite',
      code: 'AB/12',
    });
  });

  test('keeps a malformed percent-encoded segment', () => {
    expect(parseCodeFromPath('/invite/AB%')).toEqual({
      kind: 'invite',
      code: 'AB%',
    });
  });

  test('caps the code at 32 characters', () => {
    const long = 'A'.repeat(300);
    expect(parseCodeFromPath(`/invite/${long}`).code).toHaveLength(32);
  });

  test('drops trailing sentence punct like the API sanitizeReferralCode', () => {
    expect(parseCodeFromPath('/invite/AB12CD!')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/invite/AB12CD!?')).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromPath('/promo/EVT1.')).toEqual({ kind: 'promo', code: 'EVT1' });
    expect(parseCodeFromLocation('/invite', '?code=AB%2F12/')).toEqual({
      kind: 'invite',
      code: 'AB/12',
    });
    expect(parseCodeFromPath('/invite/!')).toBeNull();
    expect(parseCodeFromPath('/invite/!!!')).toBeNull();
  });

  test('trims whitespace and rejects a blank decoded segment', () => {
    expect(parseCodeFromPath('/invite/%20')).toBeNull();
    expect(parseCodeFromPath('/invite/  AB12CD  ')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/invite/AB 12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/invite/AB\u00A012CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/invite/ＡＢ１２ＣＤ')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/promo/ＥＶＴ１')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromPath('/invite/AB\u200912CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
  });

  test('strips zero-width characters from the path segment', () => {
    expect(parseCodeFromPath('/invite/AB\u200B12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/invite/AB%E2%80%8B12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseCodeFromPath('/invite/%EF%BC%A1%EF%BC%A2%EF%BC%91%EF%BC%92%EF%BC%A3%EF%BC%A4'),
    ).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/promo/\uFEFFEVT1\u200B')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromPath('/invite/\u200B')).toBeNull();
    expect(parseCodeFromPath('/invite/AB\u200E12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
  });

  test('extracts the code from a nested invite URL in the path', () => {
    expect(parseCodeFromPath('/invite/https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseCodeFromPath('/invite/' + encodeURIComponent('https://realunit.app/invite/AB12CD')),
    ).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromPath('/promo/realunit-wallet://promo/EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(
      parseCodeFromPath('/invite/intent://realunit.app/invite/AB12CD#Intent;scheme=https;end'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromPath(
        '/invite/' + encodeURIComponent('Hey Alice: https://realunit.app/invite/AB12CD'),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromPath('/promo/Hey Alice, RealUnit: https://realunit.app/promo/EVT1'),
    ).toEqual({ kind: 'promo', code: 'EVT1' });
  });
});

describe('parseCodeFromLocation', () => {
  test('path segment wins over a query code', () => {
    expect(parseCodeFromLocation('/invite/AB12CD', '?code=OTHER')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
  });

  test('reads code, invite, or promo query on a bare /invite or /promo path', () => {
    expect(parseCodeFromLocation('/invite', '?code=AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite/', 'invite=AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/promo', '?promo=EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromLocation('/PROMO/', '?code=EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(
      parseCodeFromLocation('/invite', '?app-argument=realunit-wallet://invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/promo',
        '?app-argument=' + encodeURIComponent('Hey Alice: https://realunit.app/promo/EVT1'),
      ),
    ).toEqual({ kind: 'promo', code: 'EVT1' });
  });

  test('extracts the code from an invite URL in the query', () => {
    expect(parseCodeFromLocation('/invite', '?code=https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?code=' + encodeURIComponent('Hey Alice: https://realunit.app/invite/AB12CD'),
      ),
    ).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/promo', '?promo=https://realunit.app/promo/EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
  });

  test('rejects unknown paths, missing search, and blank query codes', () => {
    expect(parseCodeFromLocation(null, '?code=AB12CD')).toBeNull();
    expect(parseCodeFromLocation('/other', '?code=AB12CD')).toBeNull();
    expect(parseCodeFromLocation('/invite', null)).toBeNull();
    expect(parseCodeFromLocation('/invite', '')).toBeNull();
    expect(parseCodeFromLocation('/invite', '', '#AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/promo', '', '#EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromLocation('/promo', null, '#EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromLocation('/invite/AB12CD', '', '#OTHER')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?code=%20')).toBeNull();
    expect(parseCodeFromLocation('/invite', '', '#')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?lang=en')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?utm_content=summer-sale')).toBeNull();
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=summer-sale&u=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=summer-sale&link=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromLocation('/', '?code=AB12CD')).toBeNull();
  });

  test('unwraps utm_content / referrer wrapping invite= or a landing URL', () => {
    expect(parseCodeFromLocation('/invite', '?utm_content=invite%3DAB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_source=google-play&utm_content=https://realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(parseCodeFromLocation('/invite', '?utm_content=realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?utm_content=/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?code=prefixinvite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?code=invite%2FAB%252F12')).toEqual({
      kind: 'invite',
      code: 'AB/12',
    });
    expect(parseCodeFromLocation('/invite', '?code=%2Finvite%2FAB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/promo', '?referrer=promo%3DEVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(parseCodeFromLocation('/invite/AB12CD', '?utm_content=OTHER')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?u=https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?q=https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?url=https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?u=hello')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?link=https://realunit.app/invite/AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?link=hello')).toBeNull();
    expect(
      parseCodeFromLocation('/invite', '?utm_content=ios-app://6759720010/invite/AB12CD'),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation('/invite', '?utm_content=https://example.com/campaign'),
    ).toBeNull();
    expect(parseCodeFromLocation('/invite', '?u=https://example.com/invite/AB12CD')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?code=https://example.com/foo')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?code=foohttps://example.com')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?code=https://example.com/foo&invite=AB12CD')).toEqual(
      { kind: 'invite', code: 'AB12CD' },
    );
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=' +
          encodeURIComponent(
            'https://realunit.app/invite?code=https://example.com/foo&invite=AB12CD',
          ),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=' + encodeURIComponent('code=https://example.com&invite=AB12CD'),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?referrer=' + encodeURIComponent('invite=https://example.com&promo=EVT1'),
      ),
    ).toEqual({ kind: 'invite', code: 'EVT1' });
    expect(parseCodeFromLocation('/promo', '?code=&promo=EVT1')).toEqual({
      kind: 'promo',
      code: 'EVT1',
    });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=' +
          encodeURIComponent(
            'https://urldefense.proofpoint.com/v2/url?u=https-3A__realunit.app_invite_AB12CD&d=Dw',
          ),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?url=' +
          encodeURIComponent(
            'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD&data=05',
          ),
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
    expect(
      parseCodeFromLocation(
        '/invite',
        '?utm_content=https://www.google.com/amp/s/realunit.app/invite/AB12CD',
      ),
    ).toEqual({ kind: 'invite', code: 'AB12CD' });
  });

  test('keeps a malformed percent-encoded query code and caps at 32', () => {
    expect(parseCodeFromLocation('/invite', '?code=AB%')).toEqual({
      kind: 'invite',
      code: 'AB%',
    });
    const long = 'A'.repeat(300);
    expect(parseCodeFromLocation('/invite', `?code=${long}`).code).toHaveLength(32);
  });
});

describe('URLs', () => {
  test('builds the public lookup URL', () => {
    expect(buildLookupUrl('https://api.dfx.swiss/', 'A B')).toBe(
      'https://api.dfx.swiss/v1/realunit/referral/code/A%20B',
    );
  });

  test('builds the custom-scheme app link', () => {
    expect(appLink('invite', 'AB12')).toBe('realunit-wallet://invite/AB12');
  });

  test('playStoreUrl appends an install referrer when a code is present', () => {
    expect(playStoreUrl('AB12CD')).toBe(
      'https://play.google.com/store/apps/details?id=swiss.realunit.app&referrer=invite%3DAB12CD',
    );
    expect(playStoreUrl('EVT1', 'promo')).toBe(
      'https://play.google.com/store/apps/details?id=swiss.realunit.app&referrer=promo%3DEVT1',
    );
    expect(playStoreUrl('')).toBe(
      'https://play.google.com/store/apps/details?id=swiss.realunit.app',
    );
  });

  test('appStoreUrl is the App Store listing', () => {
    expect(appStoreUrl()).toBe('https://apps.apple.com/ch/app/realunit/id6759720010');
  });

  test('androidIntentUrl opens the App Link or falls back to Play with referrer', () => {
    expect(androidIntentUrl('invite', 'AB12CD')).toBe(
      'intent://realunit.app/invite/AB12CD#Intent;scheme=https;package=swiss.realunit.app;S.browser_fallback_url=' +
        encodeURIComponent(
          'https://play.google.com/store/apps/details?id=swiss.realunit.app&referrer=invite%3DAB12CD',
        ) +
        ';end',
    );
    expect(openInAppUrl('promo', 'EVT1', 'android')).toContain('intent://realunit.app/promo/EVT1');
    expect(openInAppUrl('invite', 'AB12', 'ios')).toBe('realunit-wallet://invite/AB12');
    expect(openInAppUrl('invite', 'AB12', null)).toBe('realunit-wallet://invite/AB12');
    expect(androidAppUrl('invite', 'AB12CD')).toBe(
      'android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
    );
    expect(androidAppUrl('promo', 'EVT1')).toBe(
      'android-app://swiss.realunit.app/https/realunit.app/promo/EVT1',
    );
    expect(iosAppUrl('invite', 'AB12CD')).toBe(
      'ios-app://6759720010/realunit-wallet/invite/AB12CD',
    );
    expect(iosAppUrl('promo', 'EVT1')).toBe('ios-app://6759720010/realunit-wallet/promo/EVT1');
  });

  test('itunesBanner carries the custom-scheme app-argument when a code is present', () => {
    expect(itunesBanner()).toBe('app-id=6759720010');
    expect(itunesBanner('invite', 'AB12CD')).toBe(
      'app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD',
    );
    expect(itunesBanner('promo', 'EVT1')).toBe(
      'app-id=6759720010, app-argument=realunit-wallet://promo/EVT1',
    );
  });

  test('applyItunesBannerFromLocation sets app-argument from the invite path', () => {
    const el = {
      setAttribute(name, value) {
        this[name] = value;
      },
    };
    const doc = {
      querySelector(sel) {
        return sel === 'meta[name="apple-itunes-app"]' ? el : null;
      },
    };
    expect(
      applyItunesBannerFromLocation(doc, {
        pathname: '/invite/AB12CD',
        search: '',
        hash: '',
      }),
    ).toBe(true);
    expect(el.content).toBe('app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD');
    applyItunesBannerFromLocation(doc, {
      pathname: '/promo/EVT1',
      search: '',
      hash: '',
    });
    expect(el.content).toBe('app-id=6759720010, app-argument=realunit-wallet://promo/EVT1');
    applyItunesBannerFromLocation(doc, { pathname: '/invite', search: '', hash: '' });
    expect(el.content).toBe('app-id=6759720010');
    expect(applyItunesBannerFromLocation(null, { pathname: '/invite/AB12CD' })).toBe(false);
  });

  test('injectItunesBannerHtml writes app-argument into the HTML bytes', () => {
    const meta = '<meta name="apple-itunes-app" content="app-id=6759720010" />';
    expect(injectItunesBannerHtml(meta, '/invite/AB12CD', '', '')).toBe(
      '<meta name="apple-itunes-app" content="app-id=6759720010, app-argument=realunit-wallet://invite/AB12CD" />',
    );
    expect(
      injectItunesBannerHtml(
        '<meta content="app-id=6759720010" name="apple-itunes-app">',
        '/promo/EVT1',
        '',
        '',
      ),
    ).toBe(
      '<meta content="app-id=6759720010, app-argument=realunit-wallet://promo/EVT1" name="apple-itunes-app">',
    );
    expect(injectItunesBannerHtml(meta, '/invite', '', '')).toBe(meta);
    expect(injectItunesBannerHtml('<p>nope</p>', '/invite/AB12CD', '', '')).toBe('<p>nope</p>');
    expect(injectItunesBannerHtml(null, '/invite/AB12CD', '', '')).toBeNull();
    expect(injectItunesBannerHtml('apple-itunes-app', '/invite/AB12CD', '', '')).toBe(
      'apple-itunes-app',
    );
  });

  test('injectShareDescriptionHtml writes og:description from the path', () => {
    const shell =
      '<meta property="og:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="twitter:description" content="Öffne die RealUnit-App mit diesem Code." />' +
      '<meta name="description" content="Öffne die RealUnit-App mit diesem Code." />';
    expect(injectShareDescriptionHtml(shell, '/invite/AB12CD', '', '')).toBe(
      '<meta property="og:description" content="Öffne die RealUnit-App mit dem Code AB12CD." />' +
        '<meta name="twitter:description" content="Öffne die RealUnit-App mit dem Code AB12CD." />' +
        '<meta name="description" content="Öffne die RealUnit-App mit dem Code AB12CD." />',
    );
    expect(
      injectShareDescriptionHtml(
        '<meta content="Öffne die RealUnit-App mit diesem Code." property="og:description">' +
          '<meta content="Öffne die RealUnit-App mit diesem Code." name="twitter:description">' +
          '<meta content="Öffne die RealUnit-App mit diesem Code." name="description">',
        '/promo/EVT1',
        '',
        '',
      ),
    ).toBe(
      '<meta content="Öffne die RealUnit-App mit dem Code EVT1." property="og:description">' +
        '<meta content="Öffne die RealUnit-App mit dem Code EVT1." name="twitter:description">' +
        '<meta content="Öffne die RealUnit-App mit dem Code EVT1." name="description">',
    );
    expect(injectShareDescriptionHtml(shell, '/invite', '', '')).toBe(shell);
    expect(injectShareDescriptionHtml(null, '/invite/AB12CD', '', '')).toBeNull();
    expect(injectShareDescriptionHtml('<p>no tags</p>', '/invite/AB12CD', '', '')).toBe(
      '<p>no tags</p>',
    );
    expect(shareDescription('AB12CD')).toBe('Öffne die RealUnit-App mit dem Code AB12CD.');
    expect(shareDescription('AB12CD', 'en')).toBe('Open the RealUnit app with code AB12CD.');
    expect(shareDescription(null)).toBeNull();
    expect(injectShareDescriptionHtml(shell, '/invite/AB12CD', '?lang=en', '')).toContain(
      'Open the RealUnit app with code AB12CD.',
    );
  });

  test('injectShareLocaleHtml sets html lang and og:locale from ?lang=en', () => {
    expect(langFromSearch('?lang=en')).toBe('en');
    expect(langFromSearch('?lang=de')).toBe('de');
    expect(langFromSearch('?mock=1&lang=EN')).toBe('en');
    expect(langFromSearch('?lang=pt')).toBeNull();
    expect(langFromSearch('?lang=%')).toBeNull();
    expect(langFromSearch('')).toBeNull();
    const shell =
      '<html lang="de">' +
      '<meta property="og:locale" content="de_CH" />' +
      '<meta property="og:locale:alternate" content="en_GB" />';
    const out = injectShareLocaleHtml(shell, '/invite/AB12CD', '?lang=en');
    expect(out).toContain('<html lang="en">');
    expect(out).toContain('property="og:locale" content="en_GB"');
    expect(out).toContain('property="og:locale:alternate" content="de_CH"');
    expect(injectShareLocaleHtml(shell, '/invite/AB12CD', '')).toBe(shell);
  });

  test('injectShareTitleHtml writes og:title and twitter:title from the path', () => {
    const shell =
      '<meta property="og:title" content="RealUnit — Einladung" />' +
      '<meta name="twitter:title" content="RealUnit — Einladung" />';
    expect(injectShareTitleHtml(shell, '/invite/AB12CD', '', '')).toBe(
      '<meta property="og:title" content="RealUnit — Einladung AB12CD" />' +
        '<meta name="twitter:title" content="RealUnit — Einladung AB12CD" />',
    );
    expect(
      injectShareTitleHtml(
        '<meta content="RealUnit — Promo-Code" property="og:title">' +
          '<meta content="RealUnit — Promo-Code" name="twitter:title">',
        '/promo/EVT1',
        '',
        '',
      ),
    ).toBe(
      '<meta content="RealUnit — Promo-Code EVT1" property="og:title">' +
        '<meta content="RealUnit — Promo-Code EVT1" name="twitter:title">',
    );
    expect(injectShareTitleHtml(shell, '/invite', '', '')).toBe(shell);
    expect(injectShareTitleHtml(null, '/invite/AB12CD', '', '')).toBeNull();
    expect(injectShareTitleHtml('<p>no tags</p>', '/invite/AB12CD', '', '')).toBe('<p>no tags</p>');
    expect(shareTitle('invite', 'AB12CD')).toBe('RealUnit — Einladung AB12CD');
    expect(shareTitle('promo', 'EVT1')).toBe('RealUnit — Promo-Code EVT1');
    expect(shareTitle('invite', 'AB12CD', 'en')).toBe('RealUnit — Invitation AB12CD');
    expect(shareTitle('promo', 'EVT1', 'en')).toBe('RealUnit — Promo code EVT1');
    expect(shareTitle('invite', null)).toBeNull();
    expect(shareTitle(null, 'AB12CD')).toBeNull();
    const enTitle = injectShareTitleHtml(
      '<html lang="de"><title>RealUnit — Einladung</title>' + shell,
      '/invite/AB12CD',
      '?lang=en',
      '',
    );
    expect(enTitle).toContain('RealUnit — Invitation AB12CD');
    expect(enTitle).toContain('<title>RealUnit — Invitation AB12CD</title>');
  });

  test('injectShareImageAltHtml writes og:image:alt from the path', () => {
    const shell =
      '<meta property="og:image:alt" content="RealUnit" />' +
      '<meta name="twitter:image:alt" content="RealUnit" />';
    expect(injectShareImageAltHtml(shell, '/invite/AB12CD', '', '')).toBe(
      '<meta property="og:image:alt" content="RealUnit — Einladung AB12CD" />' +
        '<meta name="twitter:image:alt" content="RealUnit — Einladung AB12CD" />',
    );
    expect(
      injectShareImageAltHtml(
        '<meta content="RealUnit" property="og:image:alt">' +
          '<meta content="RealUnit" name="twitter:image:alt">',
        '/promo/EVT1',
        '',
        '',
      ),
    ).toBe(
      '<meta content="RealUnit — Promo-Code EVT1" property="og:image:alt">' +
        '<meta content="RealUnit — Promo-Code EVT1" name="twitter:image:alt">',
    );
    expect(injectShareImageAltHtml(shell, '/invite', '', '')).toBe(shell);
    expect(injectShareImageAltHtml(null, '/invite/AB12CD', '', '')).toBeNull();
    expect(injectShareImageAltHtml('<p>no tags</p>', '/invite/AB12CD', '', '')).toBe(
      '<p>no tags</p>',
    );
    const enAlt = injectShareImageAltHtml(shell, '/invite/AB12CD', '?lang=en', '');
    expect(enAlt).toContain('RealUnit — Invitation AB12CD');
  });

  test('injectLandingCanonicalHtml writes og:url and canonical from the path', () => {
    const shell =
      '<meta property="og:url" content="https://realunit.app/invite/" />' +
      '<link rel="canonical" href="https://realunit.app/invite/" />' +
      '<meta name="twitter:url" content="https://realunit.app/invite/" />';
    expect(injectLandingCanonicalHtml(shell, '/invite/AB12CD', '', '', 'www.realunit.app')).toBe(
      '<meta property="og:url" content="https://realunit.app/invite/AB12CD" />' +
        '<link rel="canonical" href="https://realunit.app/invite/AB12CD" />' +
        '<meta name="twitter:url" content="https://realunit.app/invite/AB12CD" />',
    );
    expect(
      injectLandingCanonicalHtml(
        '<meta content="https://realunit.app/promo/" property="og:url">' +
          '<link href="https://realunit.app/promo/" rel="canonical">' +
          '<meta content="https://realunit.app/promo/" name="twitter:url">',
        '/promo/EVT1',
        '',
        '',
        'dev.realunit.app',
      ),
    ).toBe(
      '<meta content="https://dev.realunit.app/promo/EVT1" property="og:url">' +
        '<link href="https://dev.realunit.app/promo/EVT1" rel="canonical">' +
        '<meta content="https://dev.realunit.app/promo/EVT1" name="twitter:url">',
    );
    expect(injectLandingCanonicalHtml(shell, '/', '', '', 'realunit.app')).toBe(shell);
    expect(injectLandingCanonicalHtml(null, '/invite/AB12CD', '', '', 'realunit.app')).toBeNull();
    expect(
      injectLandingCanonicalHtml('<p>no tags</p>', '/invite/AB12CD', '', '', 'realunit.app'),
    ).toBe('<p>no tags</p>');
    expect(landingCanonicalHref('localhost', '', 'AB12CD')).toBe(
      'https://realunit.app/invite/AB12CD',
    );
    expect(landingCanonicalHref('realunit.app', 'promo', null)).toBe('https://realunit.app/promo');
  });

  test('injectInstallHandoffHtml sets Play referrer and alternate links', () => {
    const shell =
      '<head></head><a data-store="play" href="https://play.google.com/store/apps/details?id=swiss.realunit.app">Play</a>';
    const out = injectInstallHandoffHtml(shell, '/invite/AB12CD', '', '');
    expect(out).toContain('referrer=invite%3DAB12CD');
    expect(out).toContain('android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD');
    expect(out).toContain('ios-app://6759720010/realunit-wallet/invite/AB12CD');
    const promo = injectInstallHandoffHtml(
      '<a href="https://play.google.com/store/apps/details?id=swiss.realunit.app" data-store="play">P</a>',
      '/promo/EVT1',
      '',
      '',
    );
    expect(promo).toContain('referrer=promo%3DEVT1');
    expect(injectInstallHandoffHtml(shell, '/invite', '', '')).toBe(shell);
    expect(injectInstallHandoffHtml(null, '/invite/AB12CD', '', '')).toBeNull();
    const existing =
      '<link rel="alternate" data-android-app href="old" />' +
      '<link href="old" data-ios-app rel="alternate" />';
    const replaced = injectInstallHandoffHtml(existing, '/invite/AB12CD', '', '');
    expect(replaced).toContain(
      'href="android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD"',
    );
    expect(replaced).toContain('href="ios-app://6759720010/realunit-wallet/invite/AB12CD"');
    expect(injectInstallHandoffHtml('<p>no head</p>', '/invite/AB12CD', '', '')).toContain(
      'data-android-app',
    );
  });

  test('injectShareAppLinksHtml writes Facebook App Links from the path', () => {
    const out = injectShareAppLinksHtml(
      '<head></head>',
      '/invite/AB12CD',
      '',
      '',
      'www.realunit.app',
    );
    expect(out).toContain('property="al:ios:url" content="realunit-wallet://invite/AB12CD"');
    expect(out).toContain('property="al:ios:app_store_id" content="6759720010"');
    expect(out).toContain('property="al:ios:app_name" content="RealUnit"');
    expect(out).toContain('property="al:android:url" content="realunit-wallet://invite/AB12CD"');
    expect(out).toContain('property="al:android:package" content="swiss.realunit.app"');
    expect(out).toContain('property="al:android:class" content="swiss.realunit.app.MainActivity"');
    expect(out).toContain('property="al:android:app_name" content="RealUnit"');
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
    const promo = injectShareAppLinksHtml(
      '<meta property="al:ios:url" content="old" />' +
        '<meta content="old" property="al:android:url">',
      '/promo/EVT1',
      '',
      '',
      'dev.realunit.app',
    );
    expect(promo).toContain('content="realunit-wallet://promo/EVT1"');
    expect(promo).toContain('content="https://dev.realunit.app/promo/EVT1"');
    expect(injectShareAppLinksHtml('<head></head>', '/invite', '', '', 'realunit.app')).toBe(
      '<head></head>',
    );
    expect(injectShareAppLinksHtml(null, '/invite/AB12CD', '', '', 'realunit.app')).toBeNull();
    expect(
      injectShareAppLinksHtml('<p>no head</p>', '/invite/AB12CD', '', '', 'realunit.app'),
    ).toContain('al:ios:url');
  });

  test('injectSiteNameHtml writes og:site_name RealUnit', () => {
    expect(injectSiteNameHtml('<head></head>')).toContain(
      'property="og:site_name" content="RealUnit"',
    );
    expect(injectSiteNameHtml('<meta property="og:site_name" content="old" />')).toContain(
      'content="RealUnit"',
    );
    expect(injectSiteNameHtml(null)).toBeNull();
  });

  test('injectTwitterAppHtml writes Twitter App Card urls from the campaign code', () => {
    const out = injectTwitterAppHtml('<head></head>', 'invite', 'AB12CD');
    expect(out).toContain('name="twitter:app:name:iphone" content="RealUnit"');
    expect(out).toContain('name="twitter:app:id:iphone" content="6759720010"');
    expect(out).toContain(
      'name="twitter:app:url:iphone" content="realunit-wallet://invite/AB12CD"',
    );
    expect(out).toContain('name="twitter:app:url:ipad" content="realunit-wallet://invite/AB12CD"');
    expect(out).toContain(
      'name="twitter:app:url:googleplay" content="realunit-wallet://invite/AB12CD"',
    );
    expect(out).toContain('name="twitter:app:id:googleplay" content="swiss.realunit.app"');
    expect(out).toContain('name="twitter:app:country" content="CH"');
    expect(
      injectTwitterAppHtml('<meta name="twitter:app:url:iphone" content="old" />', 'promo', 'EVT1'),
    ).toContain('content="realunit-wallet://promo/EVT1"');
    expect(injectTwitterAppHtml('<head></head>', 'invite', null)).toBe('<head></head>');
    expect(injectTwitterAppHtml(null, 'invite', 'AB12CD')).toBeNull();
  });
});

describe('mapResult', () => {
  test('404/400/409/410/422 are invalid, other errors unavailable, promo vs invite from the body', () => {
    expect(mapResult(404, {})).toEqual({ state: 'invalid' });
    expect(mapResult(400, {})).toEqual({ state: 'invalid' });
    expect(mapResult(409, {})).toEqual({ state: 'invalid' });
    expect(mapResult(410, {})).toEqual({ state: 'invalid' });
    expect(mapResult(410, { code: 'SPENT' })).toEqual({
      state: 'invalid',
      code: 'SPENT',
    });
    expect(mapResult(410, { code: 'EXPIRED' })).toEqual({
      state: 'invalid',
      code: 'EXPIRED',
    });
    expect(mapResult(422, {})).toEqual({ state: 'invalid' });
    expect(mapResult(500, {})).toEqual({ state: 'unavailable' });
    expect(mapResult(503, { code: 'UNAVAILABLE', message: 'persist failed' })).toEqual({
      state: 'unavailable',
    });
    expect(mapResult(503, { code: 'UNAVAILABLE', message: 'holding lookup failed' })).toEqual({
      state: 'unavailable',
    });
    expect(mapResult(200, null)).toEqual({ state: 'unavailable' });
    expect(mapResult(200, { kind: 'promo' }).state).toBe('promo');
    expect(mapResult(200, { kind: 'Promo' }).state).toBe('promo');
    expect(mapResult(200, { kind: '  Promo  ' }).state).toBe('promo');
    expect(mapResult(200, { kind: 'invite' }).state).toBe('invite');
    expect(mapResult(200, { kind: 'Invite' }).state).toBe('invite');
    expect(mapResult(200, { actionText: 'x' }, 'promo').state).toBe('promo');
    expect(mapResult(200, { kind: 'invite' }, 'promo').state).toBe('invite');
    expect(mapResult(200, {}).state).toBe('invite');
    expect(mapResult(200, { actionText: 'x' }, 'invite').state).toBe('promo');
    expect(mapResult(200, { campaignTextEn: 'EN' }).state).toBe('promo');
    expect(mapResult(200, { actionTextEn: 'EN' }).state).toBe('promo');
    expect(mapResult(200, { inviterName: 'Björn', actionText: 'x' }).state).toBe('invite');
    expect(mapResult(200, { inviterName: '   ', actionText: 'x' }).state).toBe('promo');
  });

  test('personDisplayName keeps people and drops wallets and numeric ids', () => {
    expect(core.personDisplayName('Björn')).toBe('Björn');
    expect(core.personDisplayName('  Alice  ')).toBe('Alice');
    expect(core.personDisplayName('   ')).toBe('');
    expect(core.personDisplayName('0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B')).toBe('');
    expect(core.personDisplayName('12345')).toBe('');
    expect(core.personDisplayName(null)).toBe('');
  });

  test('410 SPENT uses spent landing copy, EXPIRED stays invalid', () => {
    const spent = core.invalidLandingCopy({ state: 'invalid', code: 'SPENT' }, I18N.de);
    expect(spent.title).toBe('Code bereits eingelöst');
    expect(spent.body).toMatch(/bereits verwendet/);
    const expired = core.invalidLandingCopy({ state: 'invalid', code: 'EXPIRED' }, I18N.de);
    expect(expired.title).toBe(I18N.de['invalid.title']);
    expect(core.invalidLandingCopy({ state: 'invalid' }, I18N.en).title).toBe(
      I18N.en['invalid.title'],
    );
  });

  test('unwraps data/item/result/payload maps on a 200 lookup', () => {
    expect(mapResult(200, { data: { kind: 'promo', actionText: '20 extra' } })).toEqual({
      state: 'promo',
      payload: { kind: 'promo', actionText: '20 extra' },
    });
    expect(
      mapResult(200, { item: { kind: 'invite', inviterName: 'Björn' } }).payload.inviterName,
    ).toBe('Björn');
    expect(mapResult(200, { result: { kind: 'Promo' } }).state).toBe('promo');
    expect(mapResult(200, { payload: { kind: 'invite' } }).state).toBe('invite');
    expect(mapResult(200, { data: ['not-a-map'], kind: 'invite' }).state).toBe('invite');
    expect(mapResult(200, { data: 12, kind: 'invite' }).state).toBe('invite');
    expect(
      mapResult(200, {
        kind: 'invite',
        inviterName: 'Björn',
        data: { kind: 'promo' },
      }).payload.inviterName,
    ).toBe('Björn');
    expect(mapResult(200, [])).toEqual({ state: 'unavailable' });
    expect(mapResult(200, 'missing')).toEqual({ state: 'unavailable' });
  });

  test('NestJS unmounted-route 404 is unavailable, not expired', () => {
    expect(
      mapResult(404, { statusCode: 404, message: 'Cannot GET /v1/realunit/referral/code/TEST' }),
    ).toEqual({ state: 'unavailable' });
    expect(mapResult(404, { message: ['Cannot POST /v1/realunit/referral/bind'] })).toEqual({
      state: 'unavailable',
    });
    expect(
      mapResult(404, {
        message: 'Route GET:/v1/realunit/referral/code/TEST not found',
      }),
    ).toEqual({ state: 'unavailable' });
    expect(mapResult(404, { message: 'Not found' })).toEqual({ state: 'invalid' });
    expect(mapResult(404, { message: 12 })).toEqual({ state: 'invalid' });
    expect(mapResult(404, null)).toEqual({ state: 'invalid' });
    expect(mapResult(404, 'missing')).toEqual({ state: 'invalid' });
  });
});

describe('promoBody', () => {
  const payload = {
    actionText: 'DE action',
    campaignTextEn: 'EN campaign',
  };

  test('EN prefers campaignTextEn and falls back to DE', () => {
    expect(promoBody(payload, 'en')).toBe('EN campaign');
    expect(promoBody({ actionText: 'DE only' }, 'en')).toBe('DE only');
  });

  test('DE prefers actionText/campaignText', () => {
    expect(promoBody(payload, 'de')).toBe('DE action');
    expect(promoBody(null, 'de')).toBe('');
  });

  test('EN ignores empty campaignTextEn', () => {
    expect(promoBody({ campaignTextEn: '', actionText: 'DE action' }, 'en')).toBe('DE action');
  });

  test('whitespace-only EN copy falls through to DE', () => {
    expect(promoBody({ campaignTextEn: '   ', actionText: 'DE action' }, 'en')).toBe('DE action');
    expect(promoBody({ campaignTextEn: 12, actionText: 'DE action' }, 'en')).toBe('DE action');
    expect(promoBody({ actionText: '  ', campaignText: 'DE campaign' }, 'de')).toBe('DE campaign');
  });

  test('empty payload yields an empty string for the landing fallback', () => {
    expect(promoBody({}, 'de')).toBe('');
  });

  test('promoBodyLang is de when EN falls back to German campaign copy', () => {
    expect(promoBodyLang({ campaignTextEn: 'EN campaign' }, 'en')).toBe('en');
    expect(promoBodyLang({ actionText: 'DE only' }, 'en')).toBe('de');
    expect(promoBodyLang({ actionTextEn: 'EN action' }, 'en')).toBe('en');
    expect(promoBodyLang({ campaignTextEn: '   ', actionText: 'DE action' }, 'en')).toBe('de');
    expect(promoBodyLang({ campaignTextEn: 'EN only' }, 'de')).toBe('en');
    expect(promoBodyLang({ actionText: 'DE action' }, 'de')).toBe('de');
    expect(promoBodyLang({}, 'en')).toBe('en');
    expect(promoBodyLang(null, 'de')).toBe('de');
  });
});

describe('inviteBody', () => {
  test('EN prefers actionTextEn and falls back to DE actionText', () => {
    expect(inviteBody({ actionText: 'DE action', actionTextEn: 'EN action' }, 'en')).toBe(
      'EN action',
    );
    expect(inviteBody({ actionText: 'DE action' }, 'en')).toBe('DE action');
    expect(inviteBody({ actionTextEn: 'EN only' }, 'de')).toBe('EN only');
    expect(inviteBody({ actionText: 'DE action' }, 'de')).toBe('DE action');
    expect(inviteBody({ actionTextEn: '   ', actionText: 'DE action' }, 'en')).toBe('DE action');
    expect(inviteBody({}, 'en')).toBe('');
    expect(inviteBody(null, 'de')).toBe('');
  });

  test('inviteBodyLang is de when EN falls back to German action text', () => {
    expect(inviteBodyLang({ actionTextEn: 'EN action' }, 'en')).toBe('en');
    expect(inviteBodyLang({ actionText: 'DE action' }, 'en')).toBe('de');
    expect(inviteBodyLang({ actionText: 'DE action' }, 'de')).toBe('de');
    expect(inviteBodyLang({ actionTextEn: 'EN only' }, 'de')).toBe('en');
    expect(inviteBodyLang({}, 'en')).toBe('en');
  });
});

describe('lookup fetch', () => {
  test('aborts after 15s and uses cache:no-store credentials:omit', () => {
    expect(LOOKUP_TIMEOUT_MS).toBe(15000);
    expect(COPY_TIMEOUT_MS).toBe(2000);
    const init = lookupFetchInit('sig');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
    expect(init.credentials).toBe('omit');
    expect(init.headers.Accept).toBe('application/json');
    expect(init.signal).toBe('sig');
  });

  test('finalizeLookup drops a payload that arrived after the budget', () => {
    expect(finalizeLookup(true, 200, { kind: 'invite' })).toEqual({ state: 'unavailable' });
    expect(finalizeLookup(false, 200, { kind: 'promo' }).state).toBe('promo');
    expect(finalizeLookup(false, 410, {})).toEqual({ state: 'invalid' });
  });
});

describe('codeFromPastedReferralUrl', () => {
  test('extracts https, wallet, android-app and ios-app invite URLs', () => {
    expect(codeFromPastedReferralUrl(null)).toBeNull();
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://realunit.app/invite?u=https://realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://realunit.app/invite?q=https://realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://realunit.app/invite?url=https://realunit.app/invite/AB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://realunit.app/invite?link=https://realunit.app/invite/AB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://realunit.app/invite?utm_content=summer-sale&u=https://realunit.app/invite/AB12CD',
      ),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite?referrer=invite%3DAB12CD')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('https://realunit.app#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('realunit.app#AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://l.facebook.com/l.php?u=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://www.google.com/url?q=https://realunit.app/promo/EVT1'),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl('https://l.facebook.com/l.php?u=https://example.com/'),
    ).toBeNull();
    expect(codeFromPastedReferralUrl('https://example.com/?utm_content=summer-sale')).toBeNull();
    expect(codeFromPastedReferralUrl('https://href.li/?https://realunit.app/invite/AB12CD')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl(
        'whatsapp://send?text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('tg://msg?text=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1'),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl('sms:?body=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'whatsapp://send?text=Tritt%20RealUnit%20bei%3A%20https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('tg://msg_url?url=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'smsto:+41791234567?body=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1',
      ),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl('mailto:?body=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'fb-messenger://share/?link=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://wa.me/?text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://t.me/share/url?url=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1',
      ),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl(
        'threema://compose?text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('sgnl://send?text=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1'),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl(
        'viber://forward?text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('line://msg/text/?https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('line://msg/text/https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'intent://send?text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD#Intent;scheme=whatsapp;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'intent://msg?text=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1#Intent;scheme=tg;end',
      ),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl(
        'intent://send/#Intent;scheme=whatsapp;S.text=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'intent://send/#Intent;scheme=whatsapp;S.browser_fallback_url=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'intent://send?text=Tritt%20RealUnit%20bei%3A%20https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD#Intent;scheme=whatsapp;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'intent://send?text=https://example.com/#Intent;scheme=whatsapp;end',
      ),
    ).toBeNull();
    expect(
      codeFromPastedReferralUrl(
        'https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Frealunit.app%2Finvite%2FAB12CD&data=05',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://urldefense.proofpoint.com/v2/url?u=https-3A__realunit.app_invite_AB12CD&d=Dw',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://urldefense.com/v3/__https://realunit.app/promo/EVT1__;!!abc$',
      ),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl('https://example.com/r/https://realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://r.search.yahoo.com/_ylt=x/RU=https%3A%2F%2Frealunit.app%2Fpromo%2FEVT1/RK=2',
      ),
    ).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://example.com/invite/AB12CD')).toBeNull();
    expect(
      codeFromPastedReferralUrl('https://www.google.com/amp/s/realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://example.com/?u=https://realunit.app:443/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://example.com/%zz/realunit.app/invite/AB12CD')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl('https://cdn.ampproject.org/c/s/www.realunit.app/promo/EVT1'),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl('https://www.google.com/amp/s/example.com/invite/AB12CD'),
    ).toBeNull();
    expect(
      codeFromPastedReferralUrl('https://realunit.app/invite/https://realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://realunit.app/invite/intent://realunit.app/invite/AB12CD#Intent;scheme=https;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://realunit.app/invite/realunit-wallet://invite/AB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('realunit-wallet://promo/EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('realunit-wallet://invite#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite#AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD',
      ),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('ios-app://6759720010/realunit-wallet/invite/AB12CD')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl(
        'android-app://swiss.realunit.app/https/realunit.app/invite?code=AB12CD',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('ios-app://6759720010/realunit-wallet/invite?code=AB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('AB12CD')).toBeNull();
    expect(codeFromPastedReferralUrl('invite')).toBeNull();
    expect(codeFromPastedReferralUrl('\u200Bhttps://realunit.app/invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('promo')).toBeNull();
    expect(codeFromPastedReferralUrl('invite?code=AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('promo?promo=EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('invite#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('promo#EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app?invite=AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/?promo=EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://www.realunit.app?utm_content=invite%3DAB12CD')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('https://realunit.app/other?invite=AB12CD')).toBeNull();
    expect(codeFromPastedReferralUrl('realunit-wallet:#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('realunit-wallet://#AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('realunit-wallet://')).toBeNull();
    expect(codeFromPastedReferralUrl('realunit-wallet:')).toBeNull();
    expect(codeFromPastedReferralUrl('https://[')).toBeNull();
    expect(codeFromPastedReferralUrl('intent://invite/AB12CD#Intent;scheme=https;end')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('intent://invite?code=AB12CD#Intent;scheme=https;end')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl('android-app://swiss.realunit.app/https/example.com/foo'),
    ).toBeNull();
    expect(codeFromPastedReferralUrl('ios-app://6759720010/invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('ios-app://6759720010/invite?code=AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('ios-app://6759720010/other')).toBeNull();
    expect(
      codeFromPastedReferralUrl(
        'intent://send/#Intent;scheme=whatsapp;S.text=https://realunit.app/invite/AB12CD;bare;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://example.com/?x=1#https://realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('=?UTF-8?Q?Hey_https=3A=2F=2Frealunit.app=2Finvite=2FAB12CD?='),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('=?UTF-8?B?@@@?=')).toBeNull();
  });

  test('empty URL protocol still reads invite path segments', () => {
    const Orig = globalThis.URL;
    globalThis.URL = function (input, base) {
      const u = base !== undefined ? new Orig(input, base) : new Orig(input);
      if (String(input).includes('empty-proto')) {
        return {
          protocol: ':',
          pathname: '/invite/AB12CD',
          search: '',
          hostname: '',
          hash: '',
        };
      }
      return u;
    };
    try {
      expect(codeFromPastedReferralUrl('https://empty-proto.example/invite/AB12CD')).toBe('AB12CD');
    } finally {
      globalThis.URL = Orig;
    }
  });

  test('RFC 2047 still decodes when TextDecoder throws', () => {
    const Orig = globalThis.TextDecoder;
    globalThis.TextDecoder = class {
      decode() {
        throw new Error('no decoder');
      }
    };
    try {
      expect(
        codeFromPastedReferralUrl('=?UTF-8?B?aHR0cHM6Ly9yZWFsdW5pdC5hcHAvaW52aXRlL0FCMTJDRA==?='),
      ).toBe('AB12CD');
    } finally {
      globalThis.TextDecoder = Orig;
    }
  });

  test('extracts the code from a share message that contains an invite URL', () => {
    expect(
      codeFromPastedReferralUrl(
        'Hey Alice, Björn lädt dich ein: https://realunit.app/invite/AB12CD',
      ),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('“https://realunit.app/invite/AB12CD”')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('«https://realunit.app/promo/EVT1»')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('Hey Alice: “https://realunit.app/invite/AB12CD”')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('[Hey Alice](https://realunit.app/invite/AB12CD)')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('(https://realunit.app/promo/EVT1)')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('<a href="https://realunit.app/invite/AB12CD">Hey</a>')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('href="https://realunit.app/promo/EVT1"')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('&quot;https://realunit.app/invite/AB12CD&quot;')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('href=&quot;https://realunit.app/promo/EVT1&quot;')).toBe(
      'EVT1',
    );
    expect(codeFromPastedReferralUrl('https&#58;//realunit.app/invite/AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https&#x3a;&#x2f;&#x2f;realunit.app&#x2f;invite&#x2f;AB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app&#47;promo&#47;EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https&colon;//realunit.app&sol;invite&sol;AB12CD')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('https&colon;&sol;&sol;realunit.app&sol;promo&sol;EVT1')).toBe(
      'EVT1',
    );
    expect(codeFromPastedReferralUrl('https：／／realunit.app／invite／AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https：//realunit.app/promo/EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/ＡＢ１２ＣＤ')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https:⁄⁄realunit.app⁄invite⁄AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https:∕∕realunit.app∕promo∕EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https∶//realunit.app/invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit。app/invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://www。realunit。app/promo/EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https:\\/\\/realunit.app\\/invite\\/AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https\\u003a\\u002f\\u002frealunit.app\\u002finvite\\u002fAB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('{"url":"https:\\/\\/realunit.app\\/promo\\/EVT1"}')).toBe(
      'EVT1',
    );
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\nAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/promo/\r\nEVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app/ invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/\u2009invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/\u00A0promo/EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https:// realunit.app/invite/AB12CD please')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('> https://realunit.app/invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('> https://realunit.app/invite/\n> AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\\\nAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/promo/\\ \r\nEVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12-\nCD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/in-\nvite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/in\u2010\nvite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/in\u2011\nvite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/in\u2013\nvite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12=\nCD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/inv=\nite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/promo/EVT=\r\n1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12= \nCD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https=3A=2F=2Frealunit.app=2Finvite=2FAB12CD')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('https=3a=2f=2frealunit.app=2fpromo=2fEVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app=2Finvite=2FAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite?code=3DAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite?code=AB12CD')).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('=?UTF-8?Q?https=3A=2F=2Frealunit.app=2Finvite=2FAB12CD?='),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('=?utf-8?q?https=3A=2F=2Frealunit.app=2Fpromo=2FEVT1?=')).toBe(
      'EVT1',
    );
    expect(
      codeFromPastedReferralUrl('=?UTF-8?B?aHR0cHM6Ly9yZWFsdW5pdC5hcHAvaW52aXRlL0FCMTJDRA==?='),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        '=?UTF-8?Q?https=3A=2F=2Frealunit.app=2Finv?= =?UTF-8?Q?ite=2FAB12CD?=',
      ),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('*https://realunit.app/invite/AB12CD*')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('_https://realunit.app/promo/EVT1_')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('Hey: https://realunit.app/invite/AB12CD*')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('`https://realunit.app/invite/AB12CD`')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('See `https://realunit.app/promo/EVT1`')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('```https://realunit.app/invite/AB12CD```')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('```\nhttps://realunit.app/promo/EVT1\n```')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('| https://realunit.app/invite/AB12CD |')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('|https://realunit.app/promo/EVT1|')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD/')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('Hey Alice: https://realunit.app?invite=AB12CD please.')).toBe(
      'AB12CD',
    );
    expect(codeFromPastedReferralUrl('Open realunit-wallet://invite/AB12CD after install.')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl(
        'Open intent://realunit.app/invite/AB12CD#Intent;scheme=https;package=swiss.realunit.app;end after install.',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'Open intent://realunit.app/invite?code=AB12CD#Intent;scheme=https;end after install.',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'See android-app://swiss.realunit.app/https/realunit.app/invite/AB12CD here.',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('Tap ios-app://6759720010/realunit-wallet/promo/EVT1 please.'),
    ).toBe('EVT1');
    expect(
      codeFromPastedReferralUrl(
        'See android-app://swiss.realunit.app/https/realunit.app/invite?code=AB12CD here.',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'Tap ios-app://6759720010/realunit-wallet/invite?code=AB12CD please.',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('Hey Alice: https://realunit.app/invite?code=AB12CD please.'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('Tap https://realunit.app/invite?utm_content=invite%3DAB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('Open realunit-wallet://invite?code=AB12CD after install.'),
    ).toBe('AB12CD');
  });
});

describe('interpolate and i18n parity', () => {
  test('fills named placeholders', () => {
    expect(interpolate('Hey {invitee}', { invitee: 'Alice' })).toBe('Hey Alice');
    expect(interpolate('{inviter} lädt dich ein', { inviter: 'Björn' })).toBe(
      'Björn lädt dich ein',
    );
    expect(interpolate('Hey {invitee}', {})).toBe('Hey ');
  });

  test('invite landing body is the Entwurf 3 greeting, not share SMS', () => {
    const copy = I18N.de;
    expect(
      core.inviteLandingBody(
        {
          kind: 'invite',
          inviterName: 'Björn',
          actionText:
            'Hey Alice, Björn lädt dich ein zu RealUnit: https://realunit.app/invite/AB12CD',
        },
        copy,
      ),
    ).toBe('Björn lädt dich ein zu RealUnit.');
    expect(core.inviteLandingBody({ kind: 'invite' }, copy)).toBe(
      'Du bist zu RealUnit eingeladen.',
    );
    expect(
      core.inviteLandingBody({ inviterName: '0x553C7f9C780316FC1D34b8e14ac2465Ab22a090B' }, copy),
    ).toBe('Du bist zu RealUnit eingeladen.');
  });

  test('de invite copy uses Hey {invitee} and a separate inviter line', () => {
    expect(I18N.de['invite.title']).toBe('Hey {invitee}');
    expect(I18N.de['invite.body']).toBe('{inviter} lädt dich ein zu RealUnit.');
    expect(I18N.de['invite.body.fallback']).toBe('Du bist zu RealUnit eingeladen.');
    expect(I18N.de['promo.body.fallback']).toMatch(/Promo-Code/);
    expect(I18N.de.retap).toMatch(/nochmals antippen/);
    expect(I18N.de.retap).toMatch(/Code unten kopieren/);
    expect(I18N.en.retap).toMatch(/copy the code below/);
    expect(I18N.de['code.label']).toBe('Dein Code');
    expect(I18N.de['code.copy']).toBe('Code kopieren');
    expect(I18N.de['code.checking']).toBe('Code wird geprüft…');
    expect(I18N.en['code.checking']).toBe('Checking code…');
    expect(I18N.de['link.copy']).toBe('Link kopieren');
    expect(I18N.en['link.copy']).toBe('Copy link');
    expect(I18N.de['code.hint']).toMatch(/Registrierung/);
    expect(I18N.en['code.label']).toBe('Your code');
    expect(I18N.en['code.copy']).toBe('Copy code');
    expect(I18N.de['invalid.home']).toBe('Zur Startseite');
    expect(I18N.en['invalid.home']).toBe('Back to homepage');
    expect(I18N.de['unavailable.home']).toBe('Zur Startseite');
    expect(I18N.en['unavailable.home']).toBe('Back to homepage');
  });

  test('de and en expose the same keys', () => {
    expect(Object.keys(I18N.de).sort()).toEqual(Object.keys(I18N.en).sort());
  });
});

describe('keepLandingFocus', () => {
  function el(id, inStores) {
    return {
      id: id,
      closest: function (sel) {
        return inStores && sel === '.stores' ? {} : null;
      },
    };
  }

  test('keeps copy, CTA, code, Retry, and home controls', () => {
    expect(keepLandingFocus(el('ok-copy'))).toBe(true);
    expect(keepLandingFocus(el('ok-copy-link'))).toBe(true);
    expect(keepLandingFocus(el('ok-cta'))).toBe(true);
    expect(keepLandingFocus(el('ok-code'))).toBe(true);
    expect(keepLandingFocus(el('invalid-home'))).toBe(true);
    expect(keepLandingFocus(el('unavailable-cta'))).toBe(true);
    expect(keepLandingFocus(el('unavailable-home'))).toBe(true);
  });

  test('keeps store-badge links and ignores headings', () => {
    expect(keepLandingFocus(el('store-apple', true))).toBe(true);
    expect(keepLandingFocus(el('ok-code-hint'))).toBe(false);
    expect(keepLandingFocus(el('invalid-title'))).toBe(false);
    expect(keepLandingFocus(null)).toBe(false);
  });
});

describe('remaining branch coverage', () => {
  test('html and json whitespace entities fold onto a code', () => {
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/&#9;AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/&#10;AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/&#13;AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/&#160;AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD&#1;')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\\u0009AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\\u000AAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\\u000DAB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\\u00A0AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD\\u0001')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://realunit.app/invite/\u3000AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('invite/AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('promo/EVT1')).toBe('EVT1');
    expect(codeFromPastedReferralUrl('realunit-wallet://invite??code=AB12CD')).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('realunit-wallet://invite?referrer=invite%3DAB12CD')).toBe(
      'AB12CD',
    );
    expect(
      codeFromPastedReferralUrl(
        'intent://send/#Intent;;scheme=whatsapp;S.text=https://realunit.app/invite/AB12CD;end',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl(
        'https://urldefense.proofpoint.com/v2/url?u=https-01A__example.com&d=Dw',
      ),
    ).toBeNull();
    expect(
      codeFromPastedReferralUrl('https://urldefense.proofpoint.com/v2/url?u=plain_text_only&d=Dw'),
    ).toBeNull();
    expect(parseCodeFromLocation('/invite', '', '#AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
  });

  test('android-app http host, wrapped query, and AMP host-in-path', () => {
    expect(
      codeFromPastedReferralUrl('android-app://swiss.realunit.app/http/realunit.app/invite/AB12CD'),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://realunit.app/invite?utm_content=?invite=AB12CD'),
    ).toBe('AB12CD');
    expect(codeFromPastedReferralUrl('https://example.com/x/realunit.app')).toBeNull();
    expect(parseCodeFromLocation('/invite', '?utm_content=invite%3DAB12CD', '')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '?utm_content=summer', '')).toBeNull();
  });

  test('Smart App Banner DOM helper guards and spent copy fallback', () => {
    expect(applyItunesBannerFromLocation({ querySelector: null }, { pathname: '/invite' })).toBe(
      false,
    );
    expect(
      applyItunesBannerFromLocation(
        {
          querySelector() {
            return {};
          },
        },
        { pathname: '/invite/AB12CD' },
      ),
    ).toBe(false);
    const el = { setAttribute() {} };
    expect(
      applyItunesBannerFromLocation(
        {
          querySelector() {
            return el;
          },
        },
        null,
      ),
    ).toBe(true);
    expect(core.invalidLandingCopy({ code: 'SPENT' }, {}).title).toBeUndefined();
    expect(core.inviteLandingBody({ inviterName: '' }, I18N.de)).toBe(
      I18N.de['invite.body.fallback'],
    );
    expect(core.inviteLandingBody({ inviterName: '' }, { 'invite.body': 'x' })).toBe('');
    expect(core.inviteLandingBody({ inviterName: 'Ada' }, { 'invite.body': 'Hey {inviter}' })).toBe(
      'Hey Ada',
    );
    expect(core.isReferralPathKind(null)).toBe(false);
    expect(core.isReferralSchemeToken(undefined)).toBe(false);
    expect(core.intentFragmentValues(null)).toEqual([null]);
    expect(core.codeFromWrappedQueryValue(null)).toBeNull();
    expect(core.codeFromWrappedQueryValue('')).toBeNull();
    expect(core.codeFromWrappedQueryValue('promo=EVT1')).toBe('EVT1');
    expect(core.codeFromWrappedQueryValue('code=AB12CD')).toBe('AB12CD');
    expect(core.codeFromWrappedQueryValue('foo=1&bar=2')).toBeNull();
    expect(core.codeFromWrappedQueryValue('?invite=AB12CD')).toBe('AB12CD');
    expect(core.codeFromWrappedQueryValue('code=https://example.com&invite=AB12CD')).toBe('AB12CD');
    expect(core.codeFromWrappedQueryValue('invite=https://example.com&promo=EVT1')).toBe('EVT1');
    expect(core.codeFromWrappedQueryValue('invite=&promo=EVT1')).toBe('EVT1');
    expect(parseCodeFromLocation('/invite', '?referrer=invite%3DAB12CD', '')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(parseCodeFromLocation('/invite', '', 'AB12CD')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
    expect(codeFromPastedReferralUrl('https://example.com/?u=hello-realunit.app')).toBeNull();
    expect(codeFromPastedReferralUrl('https://example.com/?u=hello-3A_world')).toBeNull();
    expect(codeFromPastedReferralUrl('https://example.com/?u=realunit-3A_world')).toBeNull();
    expect(
      codeFromPastedReferralUrl(
        'https://urldefense.proofpoint.com/v2/url?u=https-3A__realunit-2Eapp_invite_AB12CD&d=Dw',
      ),
    ).toBe('AB12CD');
    expect(
      codeFromPastedReferralUrl('https://example.com/?u=https-00A__realunit.app_invite_AB12CD'),
    ).toBeNull();
    expect(inviteBodyLang(null, 'en')).toBe('en');
    expect(inviteBodyLang({}, 'de')).toBe('de');
    const origParseInt = globalThis.parseInt;
    let nanTimes = 0;
    globalThis.parseInt = function (value, radix) {
      nanTimes += 1;
      if (nanTimes <= 3) return Number.NaN;
      return origParseInt(value, radix);
    };
    try {
      expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD\\u0041')).toBeTruthy();
      expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD&#x41;')).toBeTruthy();
      expect(codeFromPastedReferralUrl('https://realunit.app/invite/AB12CD&#65;')).toBeTruthy();
    } finally {
      globalThis.parseInt = origParseInt;
    }
    expect(mapResult(410, { code: 'spent' })).toEqual({ state: 'invalid', code: 'SPENT' });
    expect(mapResult(410, 'nope')).toEqual({ state: 'invalid' });
  });
});
