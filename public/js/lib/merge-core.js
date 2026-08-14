/**
 * Pure, side-effect-free helpers + copy shared by
 * account-merge/merge.js.
 *
 * Loaded as a classic script *before* merge.js so window.RealUnitMerge exists
 * when merge.js runs. Kept free of DOM/network access so it can be unit-tested
 * in isolation with 100% coverage (see test/merge-core.test.mjs); the DOM and
 * fetch glue stays in merge.js and is covered by the Playwright functional
 * suite.
 */
(function (global) {
  'use strict';

  var SUPPORTED_LANGS = ['de', 'en'];

  // The host names realunit.app is served under. On these the local-preview mock
  // hook is refused and the API base is fixed, so a shared production link can
  // neither render a spoofed confirmation nor be pointed at an arbitrary API.
  var REALUNIT_HOSTS = ['realunit.app', 'www.realunit.app', 'dev.realunit.app'];

  // Copy for every state, German (authored) + English. Both languages carry the
  // exact same keys — test/merge-core.test.mjs enforces parity and that every
  // data-i18n key used in the page is present here.
  var I18N = {
    de: {
      'doc.title': 'RealUnit — Accounts zusammenlegen',
      'doc.desc': 'Bestätigung der Zusammenlegung Ihrer RealUnit-Accounts.',
      'loading.title': 'Zusammenlegung läuft…',
      'loading.body': 'Einen Moment, wir legen Ihre Accounts zusammen.',
      'confirmed.title': 'Accounts zusammengelegt',
      'confirmed.desktop':
        'Ihre Accounts sind zusammengelegt. Kehren Sie auf Ihrem Smartphone zur RealUnit-App zurück.',
      'confirmed.mobile': 'Ihre Accounts sind zusammengelegt.',
      'confirmed.cta': 'Zurück zur App',
      'already-completed.title': 'Zusammenlegung bereits erfolgt',
      'already-completed.desktop':
        'Diese Accounts sind bereits zusammengelegt. Kehren Sie auf Ihrem Smartphone zur RealUnit-App zurück.',
      'already-completed.mobile': 'Diese Accounts sind bereits zusammengelegt.',
      'already-completed.cta': 'Zurück zur App',
      'invalid.title': 'Link ungültig oder abgelaufen',
      'invalid.body':
        'Dieser Link ist ungültig oder bereits abgelaufen. Bitte fordern Sie in der App eine neue Zusammenlegung an.',
      'unavailable.title': 'Dienst vorübergehend nicht erreichbar',
      'unavailable.body':
        'Wir konnten die Zusammenlegung gerade nicht abschliessen. Bitte versuchen Sie es in ein paar Minuten erneut.',
      'unavailable.cta': 'Erneut versuchen',
    },
    en: {
      'doc.title': 'RealUnit — Account merge',
      'doc.desc': 'Confirm the merge of your RealUnit accounts.',
      'loading.title': 'Merging accounts…',
      'loading.body': 'One moment — we’re merging your accounts.',
      'confirmed.title': 'Accounts merged',
      'confirmed.desktop': 'Your accounts are merged. Return to the RealUnit app on your phone.',
      'confirmed.mobile': 'Your accounts are merged.',
      'confirmed.cta': 'Back to the app',
      'already-completed.title': 'Already merged',
      'already-completed.desktop':
        'These accounts are already merged. Return to the RealUnit app on your phone.',
      'already-completed.mobile': 'These accounts are already merged.',
      'already-completed.cta': 'Back to the app',
      'invalid.title': 'Link invalid or expired',
      'invalid.body':
        'This link is invalid or has already expired. Please request a new merge in the app.',
      'unavailable.title': 'Service temporarily unavailable',
      'unavailable.body':
        'We couldn’t complete the merge right now. Please try again in a few minutes.',
      'unavailable.cta': 'Try again',
    },
  };

  // Two-letter, lower-cased language tag; '' for a missing/non-string value.
  function normalizeLang(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.slice(0, 2).toLowerCase();
  }

  // Resolve the active language. A present ?lang= is authoritative: it is
  // validated and, if unsupported, falls back to the default WITHOUT consulting
  // the browser language — the browser is only a fallback when no ?lang= is given.
  // This mirrors the original short-circuit `(urlLang || navigatorLang ||
  // default)` + supported check. Both urlLang and navigatorLang may be
  // null/undefined (no param / no navigator.language) — treated as absent, and an
  // empty ?lang= (`?lang=`) falls through to the browser just like the original.
  function resolveLang(options) {
    var supported = options.supported;
    var fromUrl = normalizeLang(options.urlLang);
    if (fromUrl) {
      return supported.indexOf(fromUrl) !== -1 ? fromUrl : options.defaultLang;
    }
    var fromNavigator = normalizeLang(options.navigatorLang);
    if (supported.indexOf(fromNavigator) !== -1) {
      return fromNavigator;
    }
    return options.defaultLang;
  }

  function isRealUnitHost(host) {
    return REALUNIT_HOSTS.indexOf(host) !== -1;
  }

  // Resolve the DFX API base for a host. Production hosts are fixed; on a local
  // preview / unknown host an explicit ?api= override wins, else DEV. There is no
  // silent production default — an unknown host is deliberately pointed at DEV.
  function apiBase(options) {
    var host = options.host;
    if (host === 'realunit.app' || host === 'www.realunit.app') {
      return 'https://api.dfx.swiss';
    }
    if (host === 'dev.realunit.app') {
      return 'https://dev.api.dfx.swiss';
    }
    if (options.paramApi) {
      return options.paramApi;
    }
    return 'https://dev.api.dfx.swiss';
  }

  // True only when the mail-link OTP is present and non-empty.
  function hasOtp(otp) {
    return typeof otp === 'string' && otp.length > 0;
  }

  // Build the mail-confirm endpoint URL. The OTP is an opaque token and is
  // percent-encoded for the query string.
  function buildConfirmUrl(base, otp) {
    return base + '/v1/auth/mail/confirm?code=' + encodeURIComponent(otp);
  }

  // Build the job-status endpoint URL. The uid is percent-encoded for the path.
  function buildJobUrl(base, uid) {
    return base + '/v1/job/' + encodeURIComponent(uid);
  }

  // True when the body looks like a DFX async job response (uid + status strings).
  function isJobResponse(body) {
    return Boolean(body) && typeof body.uid === 'string' && typeof body.status === 'string';
  }

  // Terminal job statuses that end the poll loop. Non-strings and in-flight
  // statuses (Pending, Processing, Retry, unknown) are not terminal.
  function isJobTerminal(status) {
    return status === 'Complete' || status === 'Failed' || status === 'DeadLetter';
  }

  // Map an HTTP status + body to a UI state. Order is significant: 409 is
  // already-completed, 400/404 are invalid, a 2xx job-shaped body wins over a
  // 2xx kycHash body, and everything else is unavailable.
  function mapHttpToState(statusCode, body) {
    if (statusCode === 409) {
      return 'already-completed';
    }
    if (statusCode === 400 || statusCode === 404) {
      return 'invalid';
    }
    if (statusCode >= 200 && statusCode < 300 && isJobResponse(body)) {
      return 'job';
    }
    if (statusCode >= 200 && statusCode < 300 && body && typeof body.kycHash === 'string') {
      return 'confirmed';
    }
    return 'unavailable';
  }

  global.RealUnitMerge = {
    SUPPORTED_LANGS: SUPPORTED_LANGS,
    I18N: I18N,
    resolveLang: resolveLang,
    isRealUnitHost: isRealUnitHost,
    apiBase: apiBase,
    hasOtp: hasOtp,
    buildConfirmUrl: buildConfirmUrl,
    buildJobUrl: buildJobUrl,
    isJobResponse: isJobResponse,
    isJobTerminal: isJobTerminal,
    mapHttpToState: mapHttpToState,
  };
})(window);
