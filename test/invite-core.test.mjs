import '../public/js/lib/invite-core.js';
import { describe, expect, test } from 'vitest';

const core = window.RealUnitInvite;
const {
  SUPPORTED_LANGS,
  I18N,
  resolveLang,
  isRealUnitHost,
  apiBase,
  parseCodeFromPath,
  buildLookupUrl,
  appLink,
  appStoreUrl,
  playStoreUrl,
  interpolate,
  mapResult,
  promoBody,
  LOOKUP_TIMEOUT_MS,
  lookupFetchInit,
  finalizeLookup,
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

  test('caps the code at 256 characters', () => {
    const long = 'A'.repeat(300);
    expect(parseCodeFromPath(`/invite/${long}`).code).toHaveLength(256);
  });

  test('trims whitespace and rejects a blank decoded segment', () => {
    expect(parseCodeFromPath('/invite/%20')).toBeNull();
    expect(parseCodeFromPath('/invite/  AB12CD  ')).toEqual({
      kind: 'invite',
      code: 'AB12CD',
    });
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
});

describe('mapResult', () => {
  test('404/400/409/410/422 are invalid, other errors unavailable, promo vs invite from the body', () => {
    expect(mapResult(404, {})).toEqual({ state: 'invalid' });
    expect(mapResult(400, {})).toEqual({ state: 'invalid' });
    expect(mapResult(409, {})).toEqual({ state: 'invalid' });
    expect(mapResult(410, {})).toEqual({ state: 'invalid' });
    expect(mapResult(422, {})).toEqual({ state: 'invalid' });
    expect(mapResult(500, {})).toEqual({ state: 'unavailable' });
    expect(mapResult(200, null)).toEqual({ state: 'unavailable' });
    expect(mapResult(200, { kind: 'promo' }).state).toBe('promo');
    expect(mapResult(200, { kind: 'Promo' }).state).toBe('promo');
    expect(mapResult(200, { kind: 'invite' }).state).toBe('invite');
    expect(mapResult(200, { kind: 'Invite' }).state).toBe('invite');
    expect(mapResult(200, { actionText: 'x' }, 'promo').state).toBe('promo');
    expect(mapResult(200, { kind: 'invite' }, 'promo').state).toBe('invite');
    expect(mapResult(200, {}).state).toBe('invite');
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

  test('empty payload yields an empty string for the landing fallback', () => {
    expect(promoBody({}, 'de')).toBe('');
  });
});

describe('lookup fetch', () => {
  test('aborts after 15s and uses cache:no-store credentials:omit', () => {
    expect(LOOKUP_TIMEOUT_MS).toBe(15000);
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

describe('interpolate and i18n parity', () => {
  test('fills named placeholders', () => {
    expect(interpolate('Hey {invitee}', { invitee: 'Alice' })).toBe('Hey Alice');
    expect(interpolate('{inviter} lädt dich ein', { inviter: 'Björn' })).toBe(
      'Björn lädt dich ein',
    );
    expect(interpolate('Hey {invitee}', {})).toBe('Hey ');
  });

  test('de invite copy uses Hey {invitee} and a separate inviter line', () => {
    expect(I18N.de['invite.title']).toBe('Hey {invitee}');
    expect(I18N.de['invite.body']).toBe('{inviter} lädt dich ein zu RealUnit.');
    expect(I18N.de['invite.body.fallback']).toBe('Du bist zu RealUnit eingeladen.');
    expect(I18N.de['promo.body.fallback']).toMatch(/Promo-Code/);
    expect(I18N.de.retap).toMatch(/nochmals antippen/);
  });

  test('de and en expose the same keys', () => {
    expect(Object.keys(I18N.de).sort()).toEqual(Object.keys(I18N.en).sort());
  });
});
