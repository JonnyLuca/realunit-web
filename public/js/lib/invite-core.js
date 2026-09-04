/**
 * Pure helpers for /invite/:code and /promo/:code landing pages.
 * No DOM or network. 100% unit-tested.
 */
(function (global) {
  'use strict';

  var SUPPORTED_LANGS = ['de', 'en'];
  var REALUNIT_HOSTS = ['realunit.app', 'www.realunit.app', 'dev.realunit.app'];
  var APP_STORE_ID = '6759720010';
  var APP_STORE_URL = 'https://apps.apple.com/ch/app/realunit/id' + APP_STORE_ID;
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
        'App schon installiert? Dann öffnet dieser Link sie direkt. Nach einer Neu-Installation: Link nochmals antippen oder den Code unten kopieren und bei der Registrierung einfügen.',
      'code.label': 'Dein Code',
      'code.checking': 'Code wird geprüft…',
      'code.hint': 'Falls die App den Code nicht übernimmt, gib ihn bei der Registrierung ein.',
      'code.copy': 'Code kopieren',
      'code.copied': 'Kopiert',
      'link.copy': 'Link kopieren',
      cta: 'In der App öffnen',
      'cta.desktop': 'Öffne diesen Link auf deinem Smartphone, um die App zu starten.',
      'stores.nav': 'App herunterladen',
      'stores.apple.aria': 'RealUnit im App Store laden',
      'stores.apple.alt': 'Laden im App Store',
      'stores.play.aria': 'RealUnit jetzt bei Google Play',
      'stores.play.alt': 'Jetzt bei Google Play',
      'invalid.title': 'Link ungültig oder abgelaufen',
      'invalid.body': 'Dieser Einladungs- oder Promo-Link ist ungültig oder bereits abgelaufen.',
      'invalid.home': 'Zur Startseite',
      'spent.title': 'Code bereits eingelöst',
      'spent.body': 'Dieser Einladungs- oder Promo-Code wurde bereits verwendet.',
      'unavailable.title': 'Dienst vorübergehend nicht erreichbar',
      'unavailable.body':
        'Wir konnten den Code gerade nicht prüfen. Bitte versuche es später erneut.',
      'unavailable.cta': 'Erneut versuchen',
      'unavailable.home': 'Zur Startseite',
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
        'App already installed? This link opens it directly. After a fresh install, tap the link again or copy the code below and enter it during registration.',
      'code.label': 'Your code',
      'code.checking': 'Checking code…',
      'code.hint': 'If the app does not take over the code, enter it during registration.',
      'code.copy': 'Copy code',
      'code.copied': 'Copied',
      'link.copy': 'Copy link',
      cta: 'Open in the app',
      'cta.desktop': 'Open this link on your phone to launch the app.',
      'stores.nav': 'Download the app',
      'stores.apple.aria': 'Get RealUnit on the App Store',
      'stores.apple.alt': 'Download on the App Store',
      'stores.play.aria': 'Get RealUnit on Google Play',
      'stores.play.alt': 'Get it on Google Play',
      'invalid.title': 'Link invalid or expired',
      'invalid.body': 'This invitation or promo link is invalid or has expired.',
      'invalid.home': 'Back to homepage',
      'spent.title': 'Code already used',
      'spent.body': 'This invite or promo code has already been used.',
      'unavailable.title': 'Service temporarily unavailable',
      'unavailable.body': 'We could not look up this code right now. Please try again later.',
      'unavailable.cta': 'Try again',
      'unavailable.home': 'Back to homepage',
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

  // Share / og:url / copy-link host. www is folded onto the apex so a copied
  // desktop link matches the Universal Link host in AASA.
  function canonicalOrigin(host) {
    if (host === 'dev.realunit.app') return 'https://dev.realunit.app';
    if (isRealUnitHost(host)) return 'https://realunit.app';
    return null;
  }

  // Invalid/unavailable «Zur Startseite». www is folded onto the apex;
  // local preview keeps a same-origin `/`.
  function homeUrl(host) {
    var origin = canonicalOrigin(host);
    return origin ? origin + '/' : '/';
  }

  function apiBase(options) {
    var host = options.host;
    if (host === 'realunit.app' || host === 'www.realunit.app') return 'https://api.dfx.swiss';
    if (host === 'dev.realunit.app') return 'https://dev.api.dfx.swiss';
    if (options.paramApi) return options.paramApi;
    return 'https://dev.api.dfx.swiss';
  }

  var INVISIBLE_CODE_CHARS = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;

  function stripInvisibleCodeChars(value) {
    return String(value).replace(INVISIBLE_CODE_CHARS, '');
  }

  function unescapeHtmlNumericEntity(code, raw) {
    if (code === 9) return '\t';
    if (code === 10) return '\n';
    if (code === 13) return '\r';
    if (code === 160) return ' ';
    if (code < 32 || code > 126) return raw;
    return String.fromCharCode(code);
  }

  function unescapeJsonUrlEscapes(value) {
    var text = String(value);
    if (text.indexOf('\\') === -1) return text;
    text = text.replace(/\\u([0-9A-Fa-f]{4})/g, function (m, hex) {
      var code = parseInt(hex, 16);
      if (!isFinite(code)) return m;
      if (code === 9) return '\t';
      if (code === 10) return '\n';
      if (code === 13) return '\r';
      if (code === 160) return ' ';
      if (code < 32 || code > 126) return m;
      return String.fromCharCode(code);
    });
    return text.replace(/\\\//g, '/');
  }

  function unescapeFullwidthUrlChars(value) {
    return String(value)
      .replace(/[\u3000\uFF01-\uFF5E]/g, function (ch) {
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

  function unescapeHtmlEntities(value) {
    return String(value)
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#34;/g, '"')
      .replace(/&#x22;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&colon;/gi, ':')
      .replace(/&sol;/gi, '/')
      .replace(/&equals;/gi, '=')
      .replace(/&quest;/gi, '?')
      .replace(/&num;/gi, '#')
      .replace(/&period;/gi, '.')
      .replace(/&dot;/gi, '.')
      .replace(/&commat;/gi, '@')
      .replace(/&#x([0-9A-Fa-f]+);/gi, function (m, hex) {
        var code = parseInt(hex, 16);
        if (!isFinite(code)) return m;
        return unescapeHtmlNumericEntity(code, m);
      })
      .replace(/&#([0-9]{1,7});/g, function (m, dec) {
        var code = parseInt(dec, 10);
        if (!isFinite(code)) return m;
        return unescapeHtmlNumericEntity(code, m);
      });
  }

  // Quoted-printable encodes :// as =3A=2F=2F and / as =2F.
  // Only URL bytes are decoded so ?code=AB12CD is not eaten as hex.
  var QP_URL_BYTES = {
    20: ' ',
    22: '"',
    23: '#',
    25: '%',
    26: '&',
    27: "'",
    '2B': '+',
    '2C': ',',
    '2E': '.',
    '2F': '/',
    '3A': ':',
    '3B': ';',
    '3D': '=',
    '3F': '?',
    40: '@',
  };

  function unescapeQuotedPrintableUrl(value) {
    return String(value).replace(/=([0-9A-Fa-f]{2})/g, function (m, hex) {
      var mapped = QP_URL_BYTES[hex.toUpperCase()];
      return mapped != null ? mapped : m;
    });
  }

  function bytesToUtf8(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    } catch (e) {
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return s;
    }
  }

  // Email encoded-words (=?UTF-8?Q?…?= / =?UTF-8?B?…?=) from a forwarded
  // subject. Adjacent words with only whitespace between them are
  // concatenated (RFC 2047).
  function unescapeRfc2047(value) {
    var text = String(value);
    if (text.indexOf('=?') === -1) return text;
    text = text.replace(/(\?=)[ \t\r\n\u0085\u2028\u2029]+(=\?)/g, '$1$2');
    return text.replace(/=\?[^?]+\?([QqBb])\?([^?]*)\?=/g, function (m, enc, data) {
      try {
        if (String(enc).toUpperCase() === 'B') {
          var padded = String(data).replace(/\s+/g, '');
          while (padded.length % 4) padded += '=';
          var bin = atob(padded);
          var bytes = [];
          for (var i = 0; i < bin.length; i++) bytes.push(bin.charCodeAt(i) & 0xff);
          return bytesToUtf8(bytes);
        }
        var qBytes = [];
        for (var q = 0; q < data.length; q++) {
          var ch = data.charAt(q);
          if (ch === '_') {
            qBytes.push(0x20);
            continue;
          }
          if (
            ch === '=' &&
            q + 2 < data.length &&
            /^[0-9A-Fa-f]{2}$/.test(data.slice(q + 1, q + 3))
          ) {
            qBytes.push(parseInt(data.slice(q + 1, q + 3), 16));
            q += 2;
            continue;
          }
          qBytes.push(data.charCodeAt(q));
        }
        return bytesToUtf8(qBytes);
      } catch (e) {
        return m;
      }
    });
  }

  function unwrapNestedCode(code) {
    var nested = /(?:invite|promo)\/([^/?#]+)/i.exec(code);
    return nested ? nested[1] : code;
  }

  function capCode(raw) {
    if (raw == null) return null;
    var code = unescapeFullwidthUrlChars(String(raw));
    code = stripInvisibleCodeChars(code).replace(/\s+/gu, '');
    if (!code) return null;
    // Same order as the API sanitizeReferralCode: unwrap before decode so
    // invite/AB%2F12 stays AB/12, then again after so %2Finvite%2FAB12CD works.
    code = unwrapNestedCode(code);
    try {
      code = decodeURIComponent(code);
    } catch (e) {
      // keep the raw value when it is not valid percent-encoding
    }
    code = unescapeFullwidthUrlChars(code);
    code = stripInvisibleCodeChars(code).replace(/\s+/gu, '');
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

  function isReferralPathKind(value) {
    var kind = String(value || '').toLowerCase();
    return kind === 'invite' || kind === 'promo';
  }

  function looksLikePastedUrl(value) {
    var lower = String(value || '').toLowerCase();
    if (
      lower.indexOf('http://') === 0 ||
      lower.indexOf('https://') === 0 ||
      lower.indexOf('realunit-wallet:') === 0 ||
      lower.indexOf('intent:') === 0 ||
      lower.indexOf('android-app:') === 0 ||
      lower.indexOf('ios-app:') === 0 ||
      lower.indexOf('whatsapp:') === 0 ||
      lower.indexOf('tg:') === 0 ||
      lower.indexOf('sms:') === 0 ||
      lower.indexOf('smsto:') === 0 ||
      lower.indexOf('mailto:') === 0 ||
      lower.indexOf('fb-messenger:') === 0 ||
      lower.indexOf('threema:') === 0 ||
      lower.indexOf('sgnl:') === 0 ||
      lower.indexOf('signal:') === 0 ||
      lower.indexOf('viber:') === 0 ||
      lower.indexOf('line://') === 0
    ) {
      return true;
    }
    if (lower.indexOf('/invite') === 0 || lower.indexOf('/promo') === 0) return true;
    if (lower.indexOf('invite/') === 0 || lower.indexOf('promo/') === 0) return true;
    if (lower.indexOf('invite?') === 0 || lower.indexOf('promo?') === 0) return true;
    if (lower.indexOf('invite#') === 0 || lower.indexOf('promo#') === 0) return true;
    for (var i = 0; i < REALUNIT_HOSTS.length; i++) {
      var host = REALUNIT_HOSTS[i];
      if (
        lower === host ||
        lower.indexOf(host + '/') === 0 ||
        lower.indexOf(host + '?') === 0 ||
        lower.indexOf(host + '#') === 0
      ) {
        return true;
      }
    }
    return false;
  }

  function isReferralSchemeToken(value) {
    var lower = String(value || '').toLowerCase();
    return (
      lower === 'http:' ||
      lower === 'https:' ||
      lower === 'intent:' ||
      lower === 'realunit-wallet:' ||
      lower === 'android-app:' ||
      lower === 'ios-app:'
    );
  }

  function codeFromPathSegments(segments, query) {
    if (segments.length && isReferralPathKind(segments[0])) {
      if (segments.length >= 2) {
        var rest = segments.slice(1).join('/');
        if (isReferralSchemeToken(segments[1])) {
          rest = segments[1] + '//' + segments.slice(2).join('/');
        }
        var nested = codeFromPastedReferralUrl(rest);
        if (nested) return nested;
        var fromPath = capCode(segments[1]);
        if (fromPath && !isReferralSchemeToken(fromPath)) return fromPath;
      }
    } else if (segments.length) {
      return null;
    }
    if (!query) return null;
    var qs = String(query);
    if (qs.charAt(0) === '?') qs = qs.slice(1);
    var params = new URLSearchParams(qs);
    var code = codeFromCodeQueryParams(params);
    if (!code) {
      code = codeFromWrapperQueryParams(params);
    }
    return code;
  }

  function stripTrailingPunct(url) {
    return url
      .replace(/__+;.*$/, '')
      .replace(/[.!?,;:)\]}*"'_~`|\u201C\u201D\u2018\u2019\u00AB\u00BB]+$/, '');
  }

  function embeddedReferralUrl(value) {
    var text = String(value);
    var https = text.match(
      /https?:\/\/(?:www\.|dev\.)?realunit\.app(?=[/?#]|$)(?:\/(?:invite|promo)(?:\/[^\s<>#?]*)?)?(?:[?#][^\s<>]*)?/i,
    );
    if (https) return stripTrailingPunct(https[0]);
    var wallet = text.match(
      /realunit-wallet:(?:\/\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?(?:[?#][^\s<>]*)?/i,
    );
    if (wallet) return stripTrailingPunct(wallet[0]);
    var intent = text.match(
      /intent:\/\/(?:(?:www\.|dev\.)?realunit\.app\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?(?:[?#][^\s<>]*)?/i,
    );
    if (intent) return stripTrailingPunct(intent[0]);
    var androidApp = text.match(
      /android-app:\/\/swiss\.realunit\.app\/https\/(?:www\.|dev\.)?realunit\.app\/(?:invite|promo)(?:\/[^\s<>#?]*)?(?:[?#][^\s<>]*)?/i,
    );
    if (androidApp) return stripTrailingPunct(androidApp[0]);
    var iosApp = text.match(
      /ios-app:\/\/\d+\/(?:realunit-wallet\/)?(?:invite|promo)(?:\/[^\s<>#?]*)?(?:[?#][^\s<>]*)?/i,
    );
    if (iosApp) return stripTrailingPunct(iosApp[0]);
    return null;
  }

  // Pull the code out of a pasted RealUnit invite/promo URL so lookup never
  // uses the whole URI as the token. A share message that contains such a URL
  // is reduced to the code.
  function codeFromPastedReferralUrl(raw) {
    if (raw == null) return null;
    var value = unescapeFullwidthUrlChars(unescapeJsonUrlEscapes(unescapeHtmlEntities(String(raw))))
      .replace(/^[ \t]*>+[ \t]?/gm, '')
      .replace(/\\[ \t]*[\r\n\u0085\u2028\u2029]+/g, '')
      .replace(/-[\r\n\u0085\u2028\u2029]+/g, '')
      .replace(/=[ \t]*[\r\n\u0085\u2028\u2029]+/g, '')
      .replace(/[\r\n\u0085\u2028\u2029]+/g, '')
      .replace(/(https?:\/\/|(?:www\.|dev\.)?realunit\.app|\/|[=?&])[ \t\u00A0]+/gi, '$1')
      .replace(/[ \t\u00A0]+(\/)/g, '$1');
    value = unescapeQuotedPrintableUrl(unescapeRfc2047(value)).trim();
    if (looksLikePastedUrl(value) && /[ \t\u00A0]/.test(value)) {
      value = value.split(/[ \t\u00A0]/)[0];
    }
    for (var w = 0; w < 8 && value.length >= 2; w++) {
      var start = value.charAt(0);
      var end = value.charAt(value.length - 1);
      if (
        '"\'(<*_~`|\u201C\u2018\u00AB\u201E'.indexOf(start) === -1 ||
        '"\'>)*_~`|\u201D\u2019\u00BB\u201C'.indexOf(end) === -1
      ) {
        break;
      }
      value = value.slice(1, -1).trim();
    }
    if (!value) return null;
    value = stripInvisibleCodeChars(value);
    if (!value) return null;
    if (!looksLikePastedUrl(value)) {
      var embedded = embeddedReferralUrl(value);
      if (!embedded) return null;
      value = embedded;
    }
    var lower = value.toLowerCase();

    if (lower.indexOf('realunit-wallet:') === 0) {
      var remainder = value.slice('realunit-wallet:'.length);
      if (remainder.indexOf('//') === 0) remainder = remainder.slice(2);
      var fragment = '';
      var hash = remainder.indexOf('#');
      if (hash >= 0) {
        fragment = remainder.slice(hash + 1);
        remainder = remainder.slice(0, hash);
      }
      var q = remainder.indexOf('?');
      var query = q >= 0 ? remainder.slice(q + 1) : '';
      var path = q >= 0 ? remainder.slice(0, q) : remainder;
      var fromPath = codeFromPathSegments(path.split('/').filter(Boolean), query);
      if (fromPath) return fromPath;
      if (fragment) return codeFromPastedReferralUrl(fragment) || capCode(fragment);
      return null;
    }

    var toParse = value;
    if (value.indexOf('://') === -1) {
      for (var h = 0; h < REALUNIT_HOSTS.length; h++) {
        var hostName = REALUNIT_HOSTS[h];
        if (
          lower === hostName ||
          lower.indexOf(hostName + '/') === 0 ||
          lower.indexOf(hostName + '?') === 0 ||
          lower.indexOf(hostName + '#') === 0
        ) {
          toParse = 'https://' + value;
          break;
        }
      }
    }

    var uri;
    try {
      uri =
        toParse.indexOf('://') === -1 ? new URL(toParse, 'https://realunit.app') : new URL(toParse);
    } catch (e) {
      return null;
    }

    var segs = uri.pathname.split('/').filter(Boolean);
    var search = uri.search ? uri.search.slice(1) : '';

    if (uri.protocol === 'intent:') {
      if (isRealUnitHost(uri.hostname)) return codeFromPathSegments(segs, search);
      if (isReferralPathKind(uri.hostname)) {
        if (segs.length) return capCode(segs[0]);
        return codeFromPathSegments([uri.hostname], search);
      }
      return codeFromWrapperUrl(uri);
    }

    if (uri.protocol === 'android-app:') {
      if (
        segs.length >= 3 &&
        (segs[0] === 'https' || segs[0] === 'http') &&
        isRealUnitHost(segs[1]) &&
        isReferralPathKind(segs[2])
      ) {
        if (segs.length >= 4) return capCode(segs[3]);
        return codeFromPathSegments([segs[2]], search);
      }
      return codeFromWrapperUrl(uri);
    }

    if (uri.protocol === 'ios-app:') {
      if (segs.length >= 2 && segs[0] === 'realunit-wallet' && isReferralPathKind(segs[1])) {
        if (segs.length >= 3) return capCode(segs[2]);
        return codeFromPathSegments([segs[1]], search);
      }
      if (segs.length && isReferralPathKind(segs[0])) {
        if (segs.length >= 2) return capCode(segs[1]);
        return codeFromPathSegments([segs[0]], search);
      }
      return codeFromWrapperUrl(uri);
    }

    if (uri.protocol === 'http:' || uri.protocol === 'https:') {
      if (isRealUnitHost(uri.hostname)) {
        var fromHttps = codeFromPathSegments(segs, search);
        if (fromHttps) return fromHttps;
        if (
          uri.hash &&
          uri.hash.length > 1 &&
          (segs.length === 0 || (segs.length === 1 && isReferralPathKind(segs[0])))
        ) {
          var h = uri.hash.slice(1);
          return codeFromPastedReferralUrl(h) || capCode(h);
        }
        return null;
      }
      return codeFromWrapperUrl(uri);
    }

    if (!uri.protocol || uri.protocol === ':') {
      return codeFromPathSegments(segs, search);
    }
    return codeFromWrapperUrl(uri);
  }

  // Proofpoint URL Defense v2 encodes : as -3A and / as _.
  function urlDefenseDecode(value) {
    var lower = String(value).toLowerCase();
    if (lower.indexOf('realunit.app/') !== -1 || lower.indexOf('realunit.app?') !== -1) {
      return null;
    }
    // Host may still be Proofpoint-encoded (`realunit-2Eapp`) so this is
    // only a cheap skip; the decoded string is checked below.
    if (lower.indexOf('realunit') === -1) return null;
    if (value.indexOf('-') === -1 && value.indexOf('_') === -1) return null;
    var decoded = String(value)
      .replace(/-([0-9A-Fa-f]{2})/g, function (_, hex) {
        var code = parseInt(hex, 16);
        if (code < 32 || code > 126) return _;
        return String.fromCharCode(code);
      })
      .replace(/_/g, '/');
    if (decoded === value) return null;
    if (decoded.toLowerCase().indexOf('realunit.app') === -1) return null;
    return decoded;
  }

  // Chrome Android intent://send?text=…#Intent;scheme=whatsapp;end (and
  // Telegram/SMS) put the landing URL in a query param or an #Intent;
  // string extra (S.text, S.browser_fallback_url). Split extras so ;end
  // is not glued onto the code.
  function intentFragmentValues(fragment) {
    var trimmed = String(fragment || '').trim();
    var lower = trimmed.toLowerCase();
    var values = [];
    if (lower === 'intent' || lower.indexOf('intent;') === 0) {
      var extras = trimmed.split(';');
      for (var i = 0; i < extras.length; i++) {
        var extra = extras[i];
        if (!extra) continue;
        var extraLower = extra.toLowerCase();
        if (extraLower === 'intent' || extraLower === 'end') continue;
        var eq = extra.indexOf('=');
        if (eq <= 0) {
          values.push(extra);
          continue;
        }
        values.push(extra.slice(eq + 1));
        values.push(extra.slice(0, eq));
      }
      return values;
    }
    values.push(fragment);
    return values;
  }

  // Query wrappers (Facebook l.php?u=, Google url?q=, href.li), path-nested
  // landing URLs (Yahoo RU=https://…, /r/https://realunit.app/invite/…),
  // AMP/CDN paths (/amp/s/realunit.app/invite/…), Outlook Safe Links url=,
  // Proofpoint URL Defense v2, and Chrome intent:// share-sheet extras.
  function codeFromWrapperUrl(uri) {
    var values = [];
    uri.searchParams.forEach(function (val, key) {
      values.push(val);
      if (key) values.push(key);
    });
    if (uri.search && uri.search.length > 1) values.push(uri.search.slice(1));
    function pushDecoded(value) {
      if (!value) return;
      values.push(value);
      try {
        var decoded = decodeURIComponent(value);
        if (decoded && decoded !== value) values.push(decoded);
      } catch (e) {}
    }
    if (uri.hash && uri.hash.length > 1) {
      var extras = intentFragmentValues(uri.hash.slice(1));
      for (var e = 0; e < extras.length; e++) pushDecoded(extras[e]);
    }
    if (uri.pathname && uri.pathname.length > 1) pushDecoded(uri.pathname);
    uri.pathname.split('/').forEach(pushDecoded);
    for (var i = 0; i < values.length; i++) {
      var val = unescapeQuotedPrintableUrl(
        unescapeRfc2047(
          unescapeFullwidthUrlChars(unescapeJsonUrlEscapes(unescapeHtmlEntities(values[i]))),
        ),
      );
      if (!val) continue;
      var defense = urlDefenseDecode(val);
      if (defense) {
        var fromDefense = codeFromPastedReferralUrl(defense);
        if (fromDefense) return fromDefense;
      }
      var embedded = embeddedReferralUrl(val);
      if (embedded) {
        var fromEmbedded = codeFromPastedReferralUrl(embedded);
        if (fromEmbedded) return fromEmbedded;
      }
      if (!looksLikePastedUrl(val)) continue;
      try {
        var inner = new URL(val);
        if (!isRealUnitHost(inner.hostname)) continue;
        var fromInner = codeFromPastedReferralUrl(val);
        if (fromInner) return fromInner;
      } catch (e) {}
    }
    return codeFromReferralHostInPath(uri.pathname.split('/'));
  }

  function codeFromReferralHostInPath(segments) {
    var segs = [];
    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      if (!seg) continue;
      try {
        segs.push(decodeURIComponent(seg));
      } catch (e) {
        segs.push(seg);
      }
    }
    for (var h = 0; h < segs.length; h++) {
      if (!isRealUnitHost(segs[h])) continue;
      var rest = segs.slice(h).join('/');
      return codeFromPastedReferralUrl('https://' + rest) || codeFromPastedReferralUrl(rest);
    }
    return null;
  }

  function parseCodeFromPath(pathname) {
    if (typeof pathname !== 'string') return null;
    var match = pathname.match(/^\/+(invite|promo)\/(.*)$/i);
    if (!match) return null;
    var kind = match[1].toLowerCase();
    var rest = match[2];
    var decodedRest = rest;
    try {
      decodedRest = decodeURIComponent(rest);
    } catch (e) {
      // keep the raw remainder
    }
    var nested = codeFromPastedReferralUrl(decodedRest) || codeFromPastedReferralUrl(rest);
    if (nested) return { kind: kind, code: nested };
    var first = rest.split('/').filter(Boolean)[0];
    if (first == null) return null;
    var code = capCode(first);
    if (!code) return null;
    return { kind: kind, code: code };
  }

  // Nested invite=/promo=/code= or a landing URL inside utm_content / referrer.
  // A bare campaign name is not a code. A foreign https URL is not a code.
  // An empty or foreign invite=/promo=/code= does not hide a later valid key.
  function codeFromQueryToken(raw) {
    var fromUrl = codeFromPastedReferralUrl(raw);
    if (fromUrl) return fromUrl;
    if (raw == null || raw === '') return capCode(raw);
    if (looksLikePastedUrl(raw)) return null;
    return capCode(raw);
  }

  function codeFromWrapperQueryParams(params) {
    var keys = ['utm_content', 'referrer', 'u', 'q', 'url', 'link'];
    for (var i = 0; i < keys.length; i++) {
      var val = params.get(keys[i]);
      if (!val) continue;
      var code = codeFromWrappedQueryValue(val);
      if (code) return code;
    }
    return null;
  }

  function codeFromCodeQueryParams(params) {
    var keys = ['code', 'invite', 'promo', 'app-argument'];
    for (var i = 0; i < keys.length; i++) {
      var val = params.get(keys[i]);
      if (!val) continue;
      var code = codeFromQueryToken(val);
      if (code) return code;
    }
    return codeFromQueryToken(null);
  }

  function codeFromWrappedQueryValue(raw) {
    if (raw == null || raw === '') return null;
    var fromUrl = codeFromPastedReferralUrl(raw);
    if (fromUrl) return fromUrl;
    var qs = String(raw);
    if (qs.charAt(0) === '?') qs = qs.slice(1);
    if (!/^(invite|promo|code)=/i.test(qs) && qs.indexOf('&') === -1) return null;
    var nested = new URLSearchParams(qs);
    var innerKeys = ['invite', 'promo', 'code'];
    for (var i = 0; i < innerKeys.length; i++) {
      var inner = nested.get(innerKeys[i]);
      if (!inner) continue;
      var fromInner = codeFromQueryToken(inner);
      if (fromInner) return fromInner;
    }
    return null;
  }

  // Path `/invite/{code}` wins. Bare `/invite?code=` / `?invite=` / `?promo=`
  // / `?app-argument=` is the query fallback when a shared link omitted the
  // path segment (including an iOS Smart App Banner argument). Ads/Play
  // `utm_content` / `referrer` / Facebook `u=` / Google `q=` / Outlook `url=`
  // wrapping invite= or a landing URL is last, as is email `link=`. A foreign
  // https URL is not a code; Proofpoint URL Defense and Outlook Safe Links
  // wrapping a RealUnit landing are unwrapped.
  function parseCodeFromLocation(pathname, search, hash) {
    var fromPath = parseCodeFromPath(pathname);
    if (fromPath) return fromPath;
    if (typeof pathname !== 'string') return null;
    var parts = pathname.split('/').filter(Boolean);
    var kind = parts.length ? String(parts[0]).toLowerCase() : '';
    if (kind !== 'invite' && kind !== 'promo') return null;
    var code = null;
    if (typeof search === 'string' && search) {
      var qs = search.charAt(0) === '?' ? search.slice(1) : search;
      var params = new URLSearchParams(qs);
      code = codeFromCodeQueryParams(params);
      if (!code) {
        code = codeFromWrapperQueryParams(params);
      }
    }
    if (!code && typeof hash === 'string' && hash) {
      var h = hash.charAt(0) === '#' ? hash.slice(1) : hash;
      code = codeFromQueryToken(h);
    }
    if (!code) return null;
    return { kind: kind, code: code };
  }

  var LOOKUP_TIMEOUT_MS = 15000;
  var COPY_TIMEOUT_MS = 2000;

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
  function finalizeLookup(timedOut, status, body, fallbackKind) {
    if (timedOut) return { state: 'unavailable' };
    return mapResult(status, body, fallbackKind);
  }

  // Copy, CTA, code, store badges, Retry, and Zur Startseite keep focus when
  // the landing re-shows a state (lookup finishing, invalid/unavailable).
  function keepLandingFocus(active) {
    if (!active) return false;
    var id = active.id;
    if (
      id === 'ok-copy' ||
      id === 'ok-copy-link' ||
      id === 'ok-cta' ||
      id === 'ok-code' ||
      id === 'invalid-home' ||
      id === 'unavailable-cta' ||
      id === 'unavailable-home'
    ) {
      return true;
    }
    return !!(active.closest && active.closest('.stores'));
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

  // iOS Smart App Banner. app-argument carries the custom-scheme invite/promo
  // link so a banner install can still take over the code (Play referrer
  // covers Android).
  function itunesBanner(kind, code) {
    var banner = 'app-id=' + APP_STORE_ID;
    if (kind && code) banner += ', app-argument=' + appLink(kind, code);
    return banner;
  }

  // Safari snapshots apple-itunes-app from the HTML bytes. Cloudflare
  // Pages `functions/_middleware.js` and the local dev-server rewrite
  // that meta from the request URL. This DOM helper is the CSP-safe JS
  // fallback (/js/invite-banner.js in <head>; invite.js is at </body>).
  function applyItunesBannerFromLocation(doc, loc) {
    if (!doc || typeof doc.querySelector !== 'function') return false;
    var el = doc.querySelector('meta[name="apple-itunes-app"]');
    if (!el || typeof el.setAttribute !== 'function') return false;
    var parsed = loc && parseCodeFromLocation(loc.pathname, loc.search, loc.hash);
    el.setAttribute('content', itunesBanner(parsed && parsed.kind, parsed && parsed.code));
    return true;
  }

  // Same rewrite as functions/lib/itunes-banner.js, for the committed
  // public/ HTML (generic app-id / generic og:url, no code) plus path.
  function injectItunesBannerHtml(html, pathname, search, hash) {
    if (typeof html !== 'string' || html.indexOf('apple-itunes-app') === -1) {
      return html;
    }
    var parsed = parseCodeFromLocation(pathname, search, hash);
    var content = itunesBanner(parsed && parsed.kind, parsed && parsed.code);
    var named = html.replace(
      /(<meta\b[^>]*\bname=["']apple-itunes-app["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      '$1' + content + '$3',
    );
    if (named !== html) return named;
    return html.replace(
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']apple-itunes-app["'][^>]*>)/i,
      '$1' + content + '$3',
    );
  }

  function landingCanonicalHref(host, kind, code) {
    var origin = canonicalOrigin(host) || 'https://realunit.app';
    var path = '/' + (kind || 'invite');
    if (code) path += '/' + encodeURIComponent(code);
    return origin + path;
  }

  function htmlAttrEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function replaceTaggedAttr(html, namedRe, flippedRe, value) {
    var safe = htmlAttrEscape(value);
    var rep = function (m, p1, p2, p3) {
      return p1 + safe + p3;
    };
    var named = html.replace(namedRe, rep);
    if (named !== html) return named;
    return html.replace(flippedRe, rep);
  }

  // Crawlers snapshot og:url / canonical from the HTML bytes. Same
  // path as functions/lib/itunes-banner.js (www folded onto the apex).
  function injectLandingCanonicalHtml(html, pathname, search, hash, host) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed) return html;
    var href = landingCanonicalHref(host, parsed.kind, parsed.code);
    var withOg = replaceTaggedAttr(
      html,
      /(<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:url["'][^>]*>)/i,
      href,
    );
    var withCanon = replaceTaggedAttr(
      withOg,
      /(<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["'])([^"']*)(["'][^>]*>)/i,
      /(<link\b[^>]*\bhref=["'])([^"']*)(["'][^>]*\brel=["']canonical["'][^>]*>)/i,
      href,
    );
    return replaceTaggedAttr(
      withCanon,
      /(<meta\b[^>]*\bname=["']twitter:url["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:url["'][^>]*>)/i,
      href,
    );
  }

  function langFromSearch(search) {
    var match = String(search || '').match(/(?:^|[?&])lang=([^&]*)/i);
    if (!match) return null;
    var encoded = String(match[1]);
    var raw = encoded;
    try {
      raw = decodeURIComponent(encoded);
    } catch (err) {
      raw = encoded;
    }
    raw = raw.slice(0, 2).toLowerCase();
    if (raw === 'en' || raw === 'de') return raw;
    return null;
  }

  // Crawlers snapshot og:title / twitter:title from the HTML bytes.
  // Names wait for lookup JS; the request URL can already name the code.
  function shareTitle(kind, code, lang) {
    if (!kind || !code) return null;
    if (lang === 'en') {
      return kind === 'promo' ? 'RealUnit — Promo code ' + code : 'RealUnit — Invitation ' + code;
    }
    return kind === 'promo' ? 'RealUnit — Promo-Code ' + code : 'RealUnit — Einladung ' + code;
  }

  function injectShareTitleHtml(html, pathname, search, hash) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed || !parsed.code) return html;
    var title = shareTitle(parsed.kind, parsed.code, langFromSearch(search));
    var withOg = replaceTaggedAttr(
      html,
      /(<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:title["'][^>]*>)/i,
      title,
    );
    var withTw = replaceTaggedAttr(
      withOg,
      /(<meta\b[^>]*\bname=["']twitter:title["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:title["'][^>]*>)/i,
      title,
    );
    return withTw.replace(/<title>[^<]*<\/title>/i, function () {
      return '<title>' + htmlAttrEscape(title) + '</title>';
    });
  }

  function injectShareImageAltHtml(html, pathname, search, hash) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed || !parsed.code) return html;
    var alt = shareTitle(parsed.kind, parsed.code, langFromSearch(search));
    var withOg = replaceTaggedAttr(
      html,
      /(<meta\b[^>]*\bproperty=["']og:image:alt["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:image:alt["'][^>]*>)/i,
      alt,
    );
    return replaceTaggedAttr(
      withOg,
      /(<meta\b[^>]*\bname=["']twitter:image:alt["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:image:alt["'][^>]*>)/i,
      alt,
    );
  }

  function shareDescription(code, lang) {
    if (!code) return null;
    if (lang === 'en') return 'Open the RealUnit app with code ' + code + '.';
    return 'Öffne die RealUnit-App mit dem Code ' + code + '.';
  }

  function injectShareDescriptionHtml(html, pathname, search, hash) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed || !parsed.code) return html;
    var description = shareDescription(parsed.code, langFromSearch(search));
    var withOg = replaceTaggedAttr(
      html,
      /(<meta\b[^>]*\bproperty=["']og:description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bproperty=["']og:description["'][^>]*>)/i,
      description,
    );
    var withTw = replaceTaggedAttr(
      withOg,
      /(<meta\b[^>]*\bname=["']twitter:description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']twitter:description["'][^>]*>)/i,
      description,
    );
    return replaceTaggedAttr(
      withTw,
      /(<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["'])([^"']*)(["'][^>]*>)/i,
      /(<meta\b[^>]*\bcontent=["'])([^"']*)(["'][^>]*\bname=["']description["'][^>]*>)/i,
      description,
    );
  }

  // Crawlers snapshot html lang / og:locale from the HTML bytes.
  function injectShareLocaleHtml(html, pathname, search) {
    if (typeof html !== 'string' || langFromSearch(search) !== 'en') return html;
    var out = html.replace(/<html\b([^>]*)\blang=["'][^"']*["']/i, '<html$1lang="en"');
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

  function upsertAlternate(html, dataAttr, href) {
    var named = new RegExp(
      '(<link\\b[^>]*\\b' + dataAttr + '\\b[^>]*\\bhref=["\'])([^"\']*)(["\'][^>]*>)',
      'i',
    );
    if (named.test(html)) return html.replace(named, '$1' + href + '$3');
    var flipped = new RegExp(
      '(<link\\b[^>]*\\bhref=["\'])([^"\']*)(["\'][^>]*\\b' + dataAttr + '\\b[^>]*>)',
      'i',
    );
    if (flipped.test(html)) return html.replace(flipped, '$1' + href + '$3');
    var tag = '<link rel="alternate" ' + dataAttr + ' href="' + href + '" />';
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '\n</head>');
    return html + tag;
  }

  function upsertMeta(html, keyAttr, key, content) {
    var named = new RegExp(
      '(<meta\\b[^>]*\\b' +
        keyAttr +
        '=["\']' +
        key +
        '["\'][^>]*\\bcontent=["\'])([^"\']*)(["\'][^>]*>)',
      'i',
    );
    if (named.test(html)) return html.replace(named, '$1' + content + '$3');
    var flipped = new RegExp(
      '(<meta\\b[^>]*\\bcontent=["\'])([^"\']*)(["\'][^>]*\\b' +
        keyAttr +
        '=["\']' +
        key +
        '["\'][^>]*>)',
      'i',
    );
    if (flipped.test(html)) return html.replace(flipped, '$1' + content + '$3');
    var tag = '<meta ' + keyAttr + '="' + key + '" content="' + content + '" />';
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, tag + '\n</head>');
    return html + tag;
  }

  // Crawlers snapshot og:site_name from the HTML bytes. Brand stays RealUnit.
  function injectSiteNameHtml(html) {
    if (typeof html !== 'string') return html;
    return upsertMeta(html, 'property', 'og:site_name', 'RealUnit');
  }

  // X / Twitter snapshots twitter:app:* from the HTML bytes.
  // twitter:app:url:* is the custom scheme so a tweet opens the app.
  function injectTwitterAppHtml(html, kind, code) {
    if (typeof html !== 'string' || !kind || !code) return html;
    var scheme = appLink(kind, code);
    var out = upsertMeta(html, 'name', 'twitter:app:name:iphone', 'RealUnit');
    out = upsertMeta(out, 'name', 'twitter:app:id:iphone', APP_STORE_ID);
    out = upsertMeta(out, 'name', 'twitter:app:url:iphone', scheme);
    out = upsertMeta(out, 'name', 'twitter:app:name:ipad', 'RealUnit');
    out = upsertMeta(out, 'name', 'twitter:app:id:ipad', APP_STORE_ID);
    out = upsertMeta(out, 'name', 'twitter:app:url:ipad', scheme);
    out = upsertMeta(out, 'name', 'twitter:app:name:googleplay', 'RealUnit');
    out = upsertMeta(out, 'name', 'twitter:app:id:googleplay', 'swiss.realunit.app');
    out = upsertMeta(out, 'name', 'twitter:app:url:googleplay', scheme);
    return upsertMeta(out, 'name', 'twitter:app:country', 'CH');
  }

  // WhatsApp / Facebook snapshot al:* App Links from the HTML bytes.
  // al:ios:url and al:android:url are the custom scheme; al:web:url is HTTPS.
  function injectShareAppLinksHtml(html, pathname, search, hash, host) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed || !parsed.code) return html;
    var href = landingCanonicalHref(host, parsed.kind, parsed.code);
    var scheme = appLink(parsed.kind, parsed.code);
    var out = upsertMeta(html, 'property', 'al:ios:url', scheme);
    out = upsertMeta(out, 'property', 'al:ios:app_store_id', APP_STORE_ID);
    out = upsertMeta(out, 'property', 'al:ios:app_name', 'RealUnit');
    out = upsertMeta(out, 'property', 'al:android:url', scheme);
    out = upsertMeta(out, 'property', 'al:android:package', 'swiss.realunit.app');
    out = upsertMeta(out, 'property', 'al:android:class', 'swiss.realunit.app.MainActivity');
    out = upsertMeta(out, 'property', 'al:android:app_name', 'RealUnit');
    out = upsertMeta(out, 'property', 'al:web:url', href);
    return injectTwitterAppHtml(out, parsed.kind, parsed.code);
  }

  // Play referrer + android-app / ios-app alternate links in the HTML
  // bytes so a badge tap or crawler does not wait for invite.js.
  function injectInstallHandoffHtml(html, pathname, search, hash) {
    if (typeof html !== 'string') return html;
    var parsed = parseCodeFromLocation(pathname, search, hash);
    if (!parsed || !parsed.code) return html;
    var out = replaceTaggedAttr(
      html,
      /(<a\b[^>]*\bdata-store=["']play["'][^>]*\bhref=["'])([^"']*)(["'][^>]*>)/i,
      /(<a\b[^>]*\bhref=["'])([^"']*)(["'][^>]*\bdata-store=["']play["'][^>]*>)/i,
      playStoreUrl(parsed.code, parsed.kind),
    );
    out = upsertAlternate(out, 'data-android-app', androidAppUrl(parsed.kind, parsed.code));
    return upsertAlternate(out, 'data-ios-app', iosAppUrl(parsed.kind, parsed.code));
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

  // Chrome intent: open the https App Link if the app is installed, otherwise
  // the Play Store URL with the install referrer.
  function androidIntentUrl(kind, code) {
    var path = String(kind) + '/' + encodeURIComponent(code);
    return (
      'intent://realunit.app/' +
      path +
      '#Intent;scheme=https;package=swiss.realunit.app;S.browser_fallback_url=' +
      encodeURIComponent(playStoreUrl(code, kind)) +
      ';end'
    );
  }

  function openInAppUrl(kind, code, platform) {
    if (platform === 'android') return androidIntentUrl(kind, code);
    return appLink(kind, code);
  }

  // Indexed / share-sheet App Link. The app parses this as
  // android-app://swiss.realunit.app/https/realunit.app/invite|promo/{code}.
  function androidAppUrl(kind, code) {
    return (
      'android-app://swiss.realunit.app/https/realunit.app/' + kind + '/' + encodeURIComponent(code)
    );
  }

  function iosAppUrl(kind, code) {
    return (
      'ios-app://' + APP_STORE_ID + '/realunit-wallet/' + kind + '/' + encodeURIComponent(code)
    );
  }

  function interpolate(template, values) {
    return String(template).replace(/\{(\w+)\}/g, function (_, key) {
      return values[key] == null ? '' : String(values[key]);
    });
  }

  function routeMissingMessage(body) {
    if (!body || typeof body !== 'object') return '';
    var msg = body.message;
    if (Array.isArray(msg)) msg = msg.join(' ');
    if (typeof msg !== 'string') return '';
    return msg.trim();
  }

  // NestJS 404 `Cannot GET /v1/realunit/referral/code/…` (Express) or
  // `Route GET:/v1/realunit/referral/code/… not found` (Fastify) means the
  // route is not mounted yet — not that this invite/promo code is spent.
  function isUnrouted(body) {
    var msg = routeMissingMessage(body);
    return (
      /^Cannot (GET|HEAD|POST|PUT|PATCH|DELETE) /i.test(msg) ||
      /^Route (GET|HEAD|POST|PUT|PATCH|DELETE):/i.test(msg)
    );
  }

  function hasLookupMarker(body) {
    var markers = [
      'kind',
      'inviterName',
      'inviteeName',
      'campaignText',
      'actionText',
      'actionTextEn',
      'campaignTextEn',
    ];
    for (var i = 0; i < markers.length; i++) {
      var value = body[markers[i]];
      if (typeof value === 'string' && value.trim()) return true;
    }
    return false;
  }

  function unwrapLookup(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    if (hasLookupMarker(body)) return body;
    var keys = ['data', 'item', 'result', 'payload'];
    for (var i = 0; i < keys.length; i++) {
      var inner = body[keys[i]];
      if (inner && typeof inner === 'object' && !Array.isArray(inner)) return inner;
    }
    return body;
  }

  function mapResult(status, body, fallbackKind) {
    // Keep in sync with isReferralLookupInvalid in the RealUnit app.
    if (isUnrouted(body)) return { state: 'unavailable' };
    if (status === 404 || status === 400 || status === 409 || status === 422) {
      return { state: 'invalid' };
    }
    if (status === 410) {
      var code =
        body && typeof body === 'object' && !Array.isArray(body)
          ? String(body.code || '').toUpperCase()
          : '';
      if (code === 'SPENT' || code === 'EXPIRED') {
        return { state: 'invalid', code: code };
      }
      return { state: 'invalid' };
    }
    if (status < 200 || status >= 300) return { state: 'unavailable' };
    body = unwrapLookup(body);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { state: 'unavailable' };
    var fromBody = typeof body.kind === 'string' ? body.kind.trim() : '';
    var raw = fromBody.toLowerCase();
    if (!raw) {
      var inviter = typeof body.inviterName === 'string' ? body.inviterName.trim() : '';
      var hasCampaign = !!firstNonEmpty([
        body.campaignText,
        body.campaignTextEn,
        body.actionText,
        body.actionTextEn,
      ]);
      if (!inviter && hasCampaign) raw = 'promo';
      else raw = (fallbackKind || 'invite').toLowerCase();
    }
    var kind = raw === 'promo' ? 'promo' : 'invite';
    return { state: kind, payload: body };
  }

  function personDisplayName(name) {
    var inviter = typeof name === 'string' ? name.trim() : '';
    if (!inviter) return '';
    if (/^0x[0-9a-fA-F]{40}$/.test(inviter)) return '';
    if (/^\d+$/.test(inviter)) return '';
    return inviter;
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }

  // Locale-aware campaign wording. EN falls back to DE; DE falls back to EN.
  // Empty / whitespace-only API fields must not block the fallback chain.
  function promoBody(payload, lang) {
    if (!payload || typeof payload !== 'object') return '';
    if (lang === 'en') {
      return firstNonEmpty([
        payload.campaignTextEn,
        payload.actionTextEn,
        payload.actionText,
        payload.campaignText,
      ]);
    }
    return firstNonEmpty([
      payload.actionText,
      payload.campaignText,
      payload.campaignTextEn,
      payload.actionTextEn,
    ]);
  }

  // BCP 47 tag of the campaign string [promoBody] actually returned, so the
  // landing can set lang=de on an English page when only German copy exists.
  function promoBodyLang(payload, lang) {
    if (!payload || typeof payload !== 'object' || !promoBody(payload, lang)) {
      return lang === 'en' ? 'en' : 'de';
    }
    if (lang === 'en') {
      return firstNonEmpty([payload.campaignTextEn, payload.actionTextEn]) ? 'en' : 'de';
    }
    return firstNonEmpty([payload.actionText, payload.campaignText]) ? 'de' : 'en';
  }

  // Locale-aware invite greeting body. API actionText is usually DE;
  // actionTextEn is preferred on English landings.
  function inviteBody(payload, lang) {
    if (!payload || typeof payload !== 'object') return '';
    if (lang === 'en') {
      return firstNonEmpty([payload.actionTextEn, payload.actionText]);
    }
    return firstNonEmpty([payload.actionText, payload.actionTextEn]);
  }

  // Entwurf 3: landing body is the inviter greeting, not the SMS share
  // text (which includes https://realunit.app/invite/…).
  function invalidLandingCopy(result, copy) {
    if (result && result.code === 'SPENT') {
      return {
        title: copy['spent.title'] || copy['invalid.title'],
        body: copy['spent.body'] || copy['invalid.body'],
      };
    }
    return { title: copy['invalid.title'], body: copy['invalid.body'] };
  }

  function inviteLandingBody(payload, copy) {
    var inviter = personDisplayName(payload && payload.inviterName);
    if (inviter) return interpolate(copy['invite.body'], { inviter: inviter });
    return copy['invite.body.fallback'] || '';
  }

  function inviteBodyLang(payload, lang) {
    if (!payload || typeof payload !== 'object' || !inviteBody(payload, lang)) {
      return lang === 'en' ? 'en' : 'de';
    }
    if (lang === 'en') {
      return firstNonEmpty([payload.actionTextEn]) ? 'en' : 'de';
    }
    return firstNonEmpty([payload.actionText]) ? 'de' : 'en';
  }

  global.RealUnitInvite = {
    SUPPORTED_LANGS: SUPPORTED_LANGS,
    I18N: I18N,
    LOOKUP_TIMEOUT_MS: LOOKUP_TIMEOUT_MS,
    COPY_TIMEOUT_MS: COPY_TIMEOUT_MS,
    resolveLang: resolveLang,
    isRealUnitHost: isRealUnitHost,
    canonicalOrigin: canonicalOrigin,
    homeUrl: homeUrl,
    apiBase: apiBase,
    parseCodeFromPath: parseCodeFromPath,
    parseCodeFromLocation: parseCodeFromLocation,
    codeFromPastedReferralUrl: codeFromPastedReferralUrl,
    isReferralPathKind: isReferralPathKind,
    isReferralSchemeToken: isReferralSchemeToken,
    codeFromWrappedQueryValue: codeFromWrappedQueryValue,
    intentFragmentValues: intentFragmentValues,
    buildLookupUrl: buildLookupUrl,
    appLink: appLink,
    appStoreUrl: appStoreUrl,
    itunesBanner: itunesBanner,
    applyItunesBannerFromLocation: applyItunesBannerFromLocation,
    injectItunesBannerHtml: injectItunesBannerHtml,
    injectLandingCanonicalHtml: injectLandingCanonicalHtml,
    injectShareTitleHtml: injectShareTitleHtml,
    injectShareImageAltHtml: injectShareImageAltHtml,
    shareTitle: shareTitle,
    injectShareDescriptionHtml: injectShareDescriptionHtml,
    shareDescription: shareDescription,
    langFromSearch: langFromSearch,
    injectShareLocaleHtml: injectShareLocaleHtml,
    injectSiteNameHtml: injectSiteNameHtml,
    injectTwitterAppHtml: injectTwitterAppHtml,
    injectInstallHandoffHtml: injectInstallHandoffHtml,
    injectShareAppLinksHtml: injectShareAppLinksHtml,
    landingCanonicalHref: landingCanonicalHref,
    playStoreUrl: playStoreUrl,
    androidIntentUrl: androidIntentUrl,
    openInAppUrl: openInAppUrl,
    androidAppUrl: androidAppUrl,
    iosAppUrl: iosAppUrl,
    interpolate: interpolate,
    personDisplayName: personDisplayName,
    invalidLandingCopy: invalidLandingCopy,
    mapResult: mapResult,
    promoBody: promoBody,
    promoBodyLang: promoBodyLang,
    inviteBody: inviteBody,
    inviteLandingBody: inviteLandingBody,
    inviteBodyLang: inviteBodyLang,
    lookupFetchInit: lookupFetchInit,
    finalizeLookup: finalizeLookup,
    keepLandingFocus: keepLandingFocus,
  };
})(window);
