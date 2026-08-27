/**
 * Pure helpers for /invite/:code and /promo/:code landing pages.
 * No DOM or network. 100% unit-tested.
 */
(function (global) {
  'use strict';

  var SUPPORTED_LANGS = ['de', 'en'];
  var REALUNIT_HOSTS = ['realunit.app', 'www.realunit.app', 'dev.realunit.app'];
  var APP_STORE_URL = 'https://apps.apple.com/ch/app/realunit/id6759720010';
  var PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=swiss.realunit.app';

  var I18N = {
    de: {
      'doc.title.invite': 'RealUnit — Einladung',
      'doc.title.promo': 'RealUnit — Promo-Code',
      'doc.desc': 'Öffne die RealUnit-App mit diesem Code.',
      'loading.title': 'Einladung wird geladen…',
      'loading.body': 'Einen Moment bitte.',
      'loading.title.promo': 'Promo-Code wird geladen…',
      'invite.title': 'Hey {invitee}',
      'invite.title.fallback': 'Du bist eingeladen',
      'invite.body': '{inviter} lädt dich ein zu RealUnit.',
      'invite.body.fallback': 'Du bist zu RealUnit eingeladen.',
      'invite.pitch': 'Werde Aktionärin der RealUnit Schweiz AG, direkt in deinem eigenen Wallet.',
      'promo.title': 'Promo-Code',
      'promo.body.fallback': 'Öffne die App, um den Promo-Code zu übernehmen.',
      retap:
        'App schon installiert? Dann öffnet dieser Link sie direkt. Nach einer Neu-Installation: Link einfach nochmals antippen.',
      cta: 'In der App öffnen',
      'cta.desktop': 'Öffne diesen Link auf deinem Smartphone, um die App zu starten.',
      'stores.nav': 'App herunterladen',
      'stores.apple.aria': 'RealUnit im App Store laden',
      'stores.apple.alt': 'Laden im App Store',
      'stores.play.aria': 'RealUnit jetzt bei Google Play',
      'stores.play.alt': 'Jetzt bei Google Play',
      'invalid.title': 'Link ungültig oder abgelaufen',
      'invalid.body': 'Dieser Einladungs- oder Promo-Link ist ungültig oder bereits abgelaufen.',
      'unavailable.title': 'Dienst vorübergehend nicht erreichbar',
      'unavailable.body':
        'Wir konnten den Code gerade nicht prüfen. Bitte versuche es später erneut.',
      'unavailable.cta': 'Erneut versuchen',
    },
    en: {
      'doc.title.invite': 'RealUnit — Invitation',
      'doc.title.promo': 'RealUnit — Promo code',
      'doc.desc': 'Open the RealUnit app with this code.',
      'loading.title': 'Loading invitation…',
      'loading.body': 'One moment.',
      'loading.title.promo': 'Loading promo code…',
      'invite.title': 'Hey {invitee}',
      'invite.title.fallback': 'You are invited',
      'invite.body': '{inviter} is inviting you to RealUnit.',
      'invite.body.fallback': 'You are invited to RealUnit.',
      'invite.pitch': 'Become a shareholder of RealUnit Schweiz AG, in your own wallet.',
      'promo.title': 'Promo code',
      'promo.body.fallback': 'Open the app to apply this promo code.',
      retap:
        'App already installed? This link opens it directly. After a fresh install, tap the link again.',
      cta: 'Open in the app',
      'cta.desktop': 'Open this link on your phone to launch the app.',
      'stores.nav': 'Download the app',
      'stores.apple.aria': 'Get RealUnit on the App Store',
      'stores.apple.alt': 'Download on the App Store',
      'stores.play.aria': 'Get RealUnit on Google Play',
      'stores.play.alt': 'Get it on Google Play',
      'invalid.title': 'Link invalid or expired',
      'invalid.body': 'This invitation or promo link is invalid or has expired.',
      'unavailable.title': 'Service temporarily unavailable',
      'unavailable.body': 'We could not look up this code right now. Please try again later.',
      'unavailable.cta': 'Try again',
    },
  };

  function normalizeLang(value) {
    if (typeof value !== 'string') return '';
    return value.slice(0, 2).toLowerCase();
  }

  function resolveLang(options) {
    var supported = options.supported;
    var fromUrl = normalizeLang(options.urlLang);
    if (fromUrl) {
      return supported.indexOf(fromUrl) !== -1 ? fromUrl : options.defaultLang;
    }
    var fromNavigator = normalizeLang(options.navigatorLang);
    if (supported.indexOf(fromNavigator) !== -1) return fromNavigator;
    return options.defaultLang;
  }

  function isRealUnitHost(host) {
    return REALUNIT_HOSTS.indexOf(host) !== -1;
  }

  function apiBase(options) {
    var host = options.host;
    if (host === 'realunit.app' || host === 'www.realunit.app') return 'https://api.dfx.swiss';
    if (host === 'dev.realunit.app') return 'https://dev.api.dfx.swiss';
    if (options.paramApi) return options.paramApi;
    return 'https://dev.api.dfx.swiss';
  }

  function parseCodeFromPath(pathname) {
    if (typeof pathname !== 'string') return null;
    var parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    var kind = parts[0].toLowerCase();
    var code = parts[1];
    if (kind !== 'invite' && kind !== 'promo') return null;
    try {
      code = decodeURIComponent(code);
    } catch (e) {
      // keep the raw segment
    }
    code = String(code).trim();
    if (!code) return null;
    if (code.length > 256) code = code.slice(0, 256);
    return { kind: kind, code: code };
  }

  var LOOKUP_TIMEOUT_MS = 15000;

  function lookupFetchInit(signal) {
    var init = {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
    };
    if (signal) init.signal = signal;
    return init;
  }

  // Drop a payload that arrived after the 15s budget, including a slow
  // res.json() that outlived the fetch abort.
  function finalizeLookup(timedOut, status, body) {
    if (timedOut) return { state: 'unavailable' };
    return mapResult(status, body);
  }

  function buildLookupUrl(base, code) {
    return (
      String(base).replace(/\/$/, '') + '/v1/realunit/referral/code/' + encodeURIComponent(code)
    );
  }

  function appLink(kind, code) {
    return 'realunit-wallet://' + kind + '/' + encodeURIComponent(code);
  }

  function appStoreUrl() {
    return APP_STORE_URL;
  }

  // Play Store URL. A code is attached as install referrer so Android can
  // keep it across a fresh install (`invite=<code>` or `promo=<code>`).
  function playStoreUrl(code, kind) {
    if (code) {
      var key = kind === 'promo' ? 'promo' : 'invite';
      return PLAY_STORE_BASE + '&referrer=' + encodeURIComponent(key + '=' + code);
    }
    return PLAY_STORE_BASE;
  }

  function interpolate(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] == null ? '' : String(values[key]);
    });
  }

  function mapResult(status, body) {
    // Keep in sync with isReferralLookupInvalidStatus in the RealUnit app.
    if (status === 404 || status === 400 || status === 409 || status === 410 || status === 422) {
      return { state: 'invalid' };
    }
    if (status < 200 || status >= 300) return { state: 'unavailable' };
    if (!body || typeof body !== 'object') return { state: 'unavailable' };
    var kind = String(body.kind).toLowerCase() === 'promo' ? 'promo' : 'invite';
    return { state: kind, payload: body };
  }

  // Locale-aware campaign wording. EN falls back to DE; DE falls back to EN.
  function promoBody(payload, lang) {
    if (!payload || typeof payload !== 'object') return '';
    if (lang === 'en') {
      return (
        payload.campaignTextEn ||
        payload.actionTextEn ||
        payload.actionText ||
        payload.campaignText ||
        ''
      );
    }
    return (
      payload.actionText ||
      payload.campaignText ||
      payload.campaignTextEn ||
      payload.actionTextEn ||
      ''
    );
  }

  global.RealUnitInvite = {
    SUPPORTED_LANGS: SUPPORTED_LANGS,
    I18N: I18N,
    LOOKUP_TIMEOUT_MS: LOOKUP_TIMEOUT_MS,
    resolveLang: resolveLang,
    isRealUnitHost: isRealUnitHost,
    apiBase: apiBase,
    parseCodeFromPath: parseCodeFromPath,
    buildLookupUrl: buildLookupUrl,
    appLink: appLink,
    appStoreUrl: appStoreUrl,
    playStoreUrl: playStoreUrl,
    interpolate: interpolate,
    mapResult: mapResult,
    promoBody: promoBody,
    lookupFetchInit: lookupFetchInit,
    finalizeLookup: finalizeLookup,
  };
})(window);
