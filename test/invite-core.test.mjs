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
  interpolate,
  mapResult,
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
  });

  test('rejects incomplete or unknown paths', () => {
    expect(parseCodeFromPath('/invite/')).toBeNull();
    expect(parseCodeFromPath('/other/AB12CD')).toBeNull();
    expect(parseCodeFromPath(null)).toBeNull();
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
});

describe('mapResult', () => {
  test('404/400 are invalid, other errors unavailable, promo vs invite from the body', () => {
    expect(mapResult(404, {})).toEqual({ state: 'invalid' });
    expect(mapResult(400, {})).toEqual({ state: 'invalid' });
    expect(mapResult(500, {})).toEqual({ state: 'unavailable' });
    expect(mapResult(200, null)).toEqual({ state: 'unavailable' });
    expect(mapResult(200, { kind: 'promo' }).state).toBe('promo');
    expect(mapResult(200, { kind: 'invite' }).state).toBe('invite');
  });
});

describe('interpolate and i18n parity', () => {
  test('fills named placeholders', () => {
    expect(interpolate('Hey {invitee}, {inviter}', { invitee: 'Alice', inviter: 'Björn' })).toBe(
      'Hey Alice, Björn',
    );
    expect(interpolate('Hey {invitee}', {})).toBe('Hey ');
  });

  test('de and en expose the same keys', () => {
    expect(Object.keys(I18N.de).sort()).toEqual(Object.keys(I18N.en).sort());
  });
});
