import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// Importing the classic script runs it against the jsdom window and exposes the
// helpers + copy on window.RealUnitMerge without any side effects.
import '../public/js/lib/merge-core.js';

const core = window.RealUnitMerge;
const {
  SUPPORTED_LANGS,
  I18N,
  resolveLang,
  isRealUnitHost,
  apiBase,
  hasOtp,
  buildConfirmUrl,
  buildJobUrl,
  isJobResponse,
  isJobTerminal,
  mapHttpToState,
} = core;

function resolve(overrides) {
  return resolveLang({
    urlLang: null,
    navigatorLang: null,
    supported: SUPPORTED_LANGS,
    defaultLang: 'de',
    ...overrides,
  });
}

describe('resolveLang', () => {
  test('prefers a supported ?lang= over the browser language', () => {
    expect(resolve({ urlLang: 'en', navigatorLang: 'de-DE' })).toBe('en');
  });

  test('normalizes a region-tagged ?lang= (EN-us → en)', () => {
    expect(resolve({ urlLang: 'EN-us' })).toBe('en');
  });

  test('a present but unsupported ?lang= falls back to the default (browser not consulted)', () => {
    expect(resolve({ urlLang: 'pt', navigatorLang: 'en-US' })).toBe('de');
  });

  test('uses the browser language when there is no ?lang=', () => {
    expect(resolve({ navigatorLang: 'en-GB' })).toBe('en');
  });

  test('falls back to the explicit default for an unsupported browser language', () => {
    expect(resolve({ navigatorLang: 'fr-FR' })).toBe('de');
  });

  test('falls back to the default when both inputs are absent (null)', () => {
    expect(resolve({ urlLang: null, navigatorLang: null })).toBe('de');
  });

  test('treats a non-string value as absent', () => {
    expect(resolve({ urlLang: 123, navigatorLang: undefined })).toBe('de');
  });
});

describe('isRealUnitHost', () => {
  test('true for the production and dev hosts', () => {
    expect(isRealUnitHost('realunit.app')).toBe(true);
    expect(isRealUnitHost('www.realunit.app')).toBe(true);
    expect(isRealUnitHost('dev.realunit.app')).toBe(true);
  });

  test('false for any other host', () => {
    expect(isRealUnitHost('localhost')).toBe(false);
    expect(isRealUnitHost('127.0.0.1')).toBe(false);
  });
});

describe('apiBase', () => {
  test('production hosts map to the production API', () => {
    expect(apiBase({ host: 'realunit.app' })).toBe('https://api.dfx.swiss');
    expect(apiBase({ host: 'www.realunit.app' })).toBe('https://api.dfx.swiss');
  });

  test('the dev host maps to the dev API', () => {
    expect(apiBase({ host: 'dev.realunit.app' })).toBe('https://dev.api.dfx.swiss');
  });

  test('an unknown host uses an explicit ?api= override when present', () => {
    expect(apiBase({ host: 'localhost', paramApi: 'https://api.example.test' })).toBe(
      'https://api.example.test',
    );
  });

  test('an unknown host without an override falls back to the dev API', () => {
    expect(apiBase({ host: 'localhost', paramApi: null })).toBe('https://dev.api.dfx.swiss');
  });
});

describe('hasOtp', () => {
  test('true for a non-empty string', () => {
    expect(hasOtp('abc')).toBe(true);
  });

  test('false for empty, null, undefined, or non-string', () => {
    expect(hasOtp('')).toBe(false);
    expect(hasOtp(null)).toBe(false);
    expect(hasOtp(undefined)).toBe(false);
    expect(hasOtp(123)).toBe(false);
  });
});

describe('buildConfirmUrl', () => {
  test('appends the endpoint and encodes the otp', () => {
    expect(buildConfirmUrl('https://dev.api.dfx.swiss', 'x y')).toBe(
      'https://dev.api.dfx.swiss/v1/auth/mail/confirm?code=x%20y',
    );
  });

  test('encodes slashes and unicode in the otp', () => {
    expect(buildConfirmUrl('https://x', 'a/b')).toContain('code=a%2Fb');
    expect(buildConfirmUrl('https://x', 'ü')).toContain('code=%C3%BC');
  });
});

describe('buildJobUrl', () => {
  test('appends the job path and encodes the uid', () => {
    expect(buildJobUrl('https://dev.api.dfx.swiss', 'job-1')).toBe(
      'https://dev.api.dfx.swiss/v1/job/job-1',
    );
    expect(buildJobUrl('https://x', 'a/b')).toBe('https://x/v1/job/a%2Fb');
  });
});

describe('isJobResponse', () => {
  test('true only when both uid and status are strings', () => {
    expect(isJobResponse({ uid: 'j1', status: 'Pending' })).toBe(true);
  });

  test('false for null, undefined, empty object, numeric uid, or missing status', () => {
    expect(isJobResponse(null)).toBe(false);
    expect(isJobResponse(undefined)).toBe(false);
    expect(isJobResponse({})).toBe(false);
    expect(isJobResponse({ uid: 1, status: 'Pending' })).toBe(false);
    expect(isJobResponse({ uid: 'j1' })).toBe(false);
    expect(isJobResponse({ status: 'Pending' })).toBe(false);
  });
});

describe('isJobTerminal', () => {
  test('true for Complete, Failed, and DeadLetter', () => {
    expect(isJobTerminal('Complete')).toBe(true);
    expect(isJobTerminal('Failed')).toBe(true);
    expect(isJobTerminal('DeadLetter')).toBe(true);
  });

  test('false for in-flight, unknown, or non-string statuses', () => {
    expect(isJobTerminal('Retry')).toBe(false);
    expect(isJobTerminal('Pending')).toBe(false);
    expect(isJobTerminal('Processing')).toBe(false);
    expect(isJobTerminal('unknown')).toBe(false);
    expect(isJobTerminal(null)).toBe(false);
    expect(isJobTerminal(undefined)).toBe(false);
    expect(isJobTerminal(1)).toBe(false);
  });
});

describe('mapHttpToState', () => {
  test('409 maps to already-completed for any body', () => {
    expect(mapHttpToState(409, null)).toBe('already-completed');
    expect(mapHttpToState(409, { kycHash: 'x' })).toBe('already-completed');
  });

  test('400 and 404 map to invalid', () => {
    expect(mapHttpToState(400, {})).toBe('invalid');
    expect(mapHttpToState(404, {})).toBe('invalid');
  });

  test('2xx with a job-shaped body maps to job (200 and 202)', () => {
    expect(mapHttpToState(200, { uid: 'j1', status: 'Pending' })).toBe('job');
    expect(mapHttpToState(202, { uid: 'j1', status: 'Pending' })).toBe('job');
  });

  test('2xx with a kycHash string maps to confirmed', () => {
    expect(mapHttpToState(200, { kycHash: 'x' })).toBe('confirmed');
  });

  test('2xx with both job shape and kycHash prefers job', () => {
    expect(mapHttpToState(200, { uid: 'j1', status: 'Pending', kycHash: 'x' })).toBe('job');
  });

  test('2xx with empty or null body maps to unavailable', () => {
    expect(mapHttpToState(200, {})).toBe('unavailable');
    expect(mapHttpToState(200, null)).toBe('unavailable');
  });

  test('2xx with a non-string kycHash maps to unavailable', () => {
    expect(mapHttpToState(200, { kycHash: 1 })).toBe('unavailable');
  });

  test('5xx, 429, and other codes map to unavailable', () => {
    expect(mapHttpToState(500, {})).toBe('unavailable');
    expect(mapHttpToState(503, {})).toBe('unavailable');
    expect(mapHttpToState(429, {})).toBe('unavailable');
    expect(mapHttpToState(418, {})).toBe('unavailable');
  });
});

describe('i18n copy', () => {
  test('de and en carry the exact same keys', () => {
    expect(Object.keys(I18N.en).sort()).toEqual(Object.keys(I18N.de).sort());
  });

  test('every data-i18n* key used in the merge page exists in both languages', () => {
    const html = readFileSync('public/account-merge/index.html', 'utf8');
    const keys = new Set();
    for (const match of html.matchAll(/data-i18n(?:-alt|-aria)?=["']([^"']+)["']/g)) {
      keys.add(match[1]);
    }
    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) {
      expect(I18N.de).toHaveProperty([key]);
      expect(I18N.en).toHaveProperty([key]);
    }
  });
});
