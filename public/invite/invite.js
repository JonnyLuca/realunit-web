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
  var parsed = core.parseCodeFromPath(window.location.pathname);

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
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
      setText('ok-body', payload.actionText || payload.campaignText || '');
    } else {
      document.title = copy['doc.title.invite'];
      var invitee = payload.inviteeName || '';
      setText(
        'ok-title',
        invitee
          ? core.interpolate(copy['invite.title'], { invitee: invitee })
          : copy['invite.title.fallback'],
      );
      setText(
        'ok-body',
        payload.actionText ||
          core.interpolate(copy['invite.body'], {
            inviter: payload.inviterName || '',
          }),
      );
    }
    show('state-ok');
  }

  if (params.get('mock') && !core.isRealUnitHost(window.location.hostname)) {
    render(
      core.mapResult(200, {
        kind: parsed.kind,
        inviterName: 'Björn',
        inviteeName: 'Alice',
        actionText: '',
      }),
    );
    return;
  }

  fetch(url)
    .then(function (res) {
      return res.json().then(
        function (body) {
          render(core.mapResult(res.status, body));
        },
        function () {
          render(core.mapResult(res.status, null));
        },
      );
    })
    .catch(function () {
      render({ state: 'unavailable' });
    });

  var retry = document.getElementById('unavailable-cta');
  if (retry) {
    retry.addEventListener('click', function () {
      window.location.reload();
    });
  }
})();
