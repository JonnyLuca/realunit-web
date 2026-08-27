(function () {
  'use strict';
  var core = window.RealUnitInvite;
  var params = new URLSearchParams(window.location.search);
  var lang = core.resolveLang({
    urlLang: params.get('lang'),
    navigatorLang: navigator.language,
    supported: core.SUPPORTED_LANGS,
    defaultLang: 'de',
  });
  var copy = core.I18N[lang];
  var parsed = core.parseCodeFromLocation(window.location.pathname, window.location.search);

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setMeta(selector, content) {
    var el = document.querySelector(selector);
    if (el && content) el.setAttribute('content', content);
  }

  function show(id) {
    ['state-loading', 'state-ok', 'state-invalid', 'state-unavailable'].forEach(function (name) {
      var node = document.getElementById(name);
      if (node) node.hidden = name !== id;
    });
  }

  document.documentElement.lang = lang;
  var isPromoPath = parsed && parsed.kind === 'promo';
  document.title = isPromoPath ? copy['doc.title.promo'] : copy['doc.title.invite'];
  setText('loading-title', isPromoPath ? copy['loading.title.promo'] : copy['loading.title']);
  setText('loading-body', copy['loading.body']);
  setText('invalid-title', copy['invalid.title']);
  setText('invalid-body', copy['invalid.body']);
  setText('unavailable-title', copy['unavailable.title']);
  setText('unavailable-body', copy['unavailable.body']);
  setText('unavailable-cta', copy['unavailable.cta']);
  setText('ok-cta', copy['cta']);
  setText('ok-desktop', copy['cta.desktop']);
  setText('ok-pitch', copy['invite.pitch']);
  setText('ok-retap', copy['retap']);
  var descEl = document.querySelector('meta[name="description"]');
  if (descEl && copy['doc.desc']) descEl.setAttribute('content', copy['doc.desc']);
  setMeta('meta[property="og:title"]', document.title);
  setMeta('meta[property="og:description"]', copy['doc.desc']);
  setMeta('meta[property="og:url"]', window.location.href);
  var storesNav = document.querySelector('.stores');
  if (storesNav && copy['stores.nav']) {
    storesNav.setAttribute('aria-label', copy['stores.nav']);
  }
  document.querySelectorAll('a[data-store="apple"]').forEach(function (el) {
    if (copy['stores.apple.aria']) el.setAttribute('aria-label', copy['stores.apple.aria']);
    var img = el.querySelector('img');
    if (img && copy['stores.apple.alt']) img.setAttribute('alt', copy['stores.apple.alt']);
  });
  document.querySelectorAll('a[data-store="play"]').forEach(function (el) {
    if (copy['stores.play.aria']) el.setAttribute('aria-label', copy['stores.play.aria']);
    var img = el.querySelector('img');
    if (img && copy['stores.play.alt']) img.setAttribute('alt', copy['stores.play.alt']);
  });

  if (!parsed) {
    show('state-invalid');
    return;
  }

  var base = core.apiBase({ host: window.location.hostname, paramApi: params.get('api') });
  var url = core.buildLookupUrl(base, parsed.code);
  var appHref = core.appLink(parsed.kind, parsed.code);
  var cta = document.getElementById('ok-cta');
  if (cta) cta.setAttribute('href', appHref);
  document.querySelectorAll('a[data-store="apple"]').forEach(function (el) {
    el.setAttribute('href', core.appStoreUrl());
  });
  document.querySelectorAll('a[data-store="play"]').forEach(function (el) {
    el.setAttribute('href', core.playStoreUrl(parsed.code, parsed.kind));
  });

  function render(result) {
    if (result.state === 'invalid') {
      show('state-invalid');
      return;
    }
    if (result.state === 'unavailable') {
      show('state-unavailable');
      return;
    }
    var payload = result.payload || {};
    if (result.state === 'promo') {
      document.title = copy['doc.title.promo'];
      setText('ok-title', copy['promo.title']);
      var promoText = String(core.promoBody(payload, lang) || '').trim();
      setText('ok-body', promoText || copy['promo.body.fallback']);
    } else {
      document.title = copy['doc.title.invite'];
      var invitee = String(payload.inviteeName || '').trim();
      setText(
        'ok-title',
        invitee
          ? core.interpolate(copy['invite.title'], { invitee: invitee })
          : copy['invite.title.fallback'],
      );
      var action = String(payload.actionText || '').trim();
      var inviter = String(payload.inviterName || '').trim();
      setText(
        'ok-body',
        action ||
          (inviter
            ? core.interpolate(copy['invite.body'], { inviter: inviter })
            : copy['invite.body.fallback']),
      );
    }
    show('state-ok');
    setMeta('meta[property="og:title"]', document.title);
    var okTitle = document.getElementById('ok-title');
    var okBody = document.getElementById('ok-body');
    if (okTitle && okTitle.textContent) {
      setMeta('meta[property="og:title"]', okTitle.textContent);
    }
    if (okBody && okBody.textContent) {
      setMeta('meta[property="og:description"]', okBody.textContent);
    }
  }

  // Local preview only (?mock=1|invalid|unavailable). Never honored on
  // realunit.app / dev.realunit.app, so a shared prod link cannot spoof state.
  var mock = params.get('mock');
  if (mock && !core.isRealUnitHost(window.location.hostname)) {
    if (mock === 'invalid') {
      render({ state: 'invalid' });
    } else if (mock === 'unavailable') {
      render({ state: 'unavailable' });
    } else {
      render(
        core.mapResult(
          200,
          parsed.kind === 'promo'
            ? {
                kind: 'promo',
                actionText:
                  'Mit dem Code EVT1 schenken wir dir bei deinem ersten erfolgreich abgewickelten Kauf von mindestens 200 RealUnit-Aktientoken 20 Token dazu. Die 20 Token werden als Zugabe zum Kauf gewährt und mindern damit den effektiven Kaufpreis. Gültig bis 7.9.2026, einmal je Person, begrenzt auf 100 Einlösungen, nicht kumulierbar mit einer Empfehlungsprämie. Die RealUnit Schweiz AG kann die Aktion jederzeit beenden.',
                campaignTextEn:
                  'With code EVT1 we give you 20 tokens on your first successful purchase of at least 200 RealUnit share tokens. The 20 tokens are granted as a bonus and reduce the effective purchase price. Valid until 7 Sep 2026, once per person, limited to 100 redemptions, not combinable with a referral prize. RealUnit Schweiz AG may end the campaign at any time.',
              }
            : {
                kind: 'invite',
                inviterName: 'Björn',
                inviteeName: 'Alice',
                actionText: '',
              },
        ),
      );
    }
  } else {
    var timedOut = false;
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, core.LOOKUP_TIMEOUT_MS);

    fetch(url, core.lookupFetchInit(controller.signal))
      .then(function (res) {
        return res.json().then(
          function (body) {
            return { status: res.status, body: body };
          },
          function () {
            return { status: res.status, body: null };
          },
        );
      })
      .then(function (r) {
        clearTimeout(timeoutId);
        render(core.finalizeLookup(timedOut, r.status, r.body, parsed.kind));
      })
      .catch(function () {
        clearTimeout(timeoutId);
        render({ state: 'unavailable' });
      });
  }

  var retry = document.getElementById('unavailable-cta');
  if (retry) {
    retry.addEventListener('click', function () {
      window.location.reload();
    });
  }
})();
