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
  var parsed = core.parseCodeFromLocation(
    window.location.pathname,
    window.location.search,
    window.location.hash,
  );

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setCodeHint(text, busy) {
    setText('ok-code-hint', text);
    var hint = document.getElementById('ok-code-hint');
    if (hint) hint.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function hideLoading() {
    var loading = document.getElementById('state-loading');
    if (!loading) return;
    loading.hidden = true;
    loading.setAttribute('aria-busy', 'false');
  }

  function setMeta(selector, content) {
    var el = document.querySelector(selector);
    if (el && content) el.setAttribute('content', content);
  }

  var THEME_BLUE = '#1988C6';
  var THEME_RED = '#E02523';
  function setThemeColor(color) {
    setMeta('meta[name="theme-color"]', color);
  }

  function setCanonical(kind, code) {
    var path = '/' + (kind || 'invite');
    if (code) path += '/' + encodeURIComponent(code);
    var href = (core.canonicalOrigin(window.location.hostname) || window.location.origin) + path;
    setMeta('meta[property="og:url"]', href);
    setMeta('meta[name="twitter:url"]', href);
    var link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  function ensureMeta(selector, keyAttr, key) {
    var el = document.querySelector(selector);
    if (el) return el;
    el = document.createElement('meta');
    el.setAttribute(keyAttr, key);
    document.head.appendChild(el);
    return el;
  }

  function setShareMeta(title, description) {
    if (title) {
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[name="twitter:title"]', title);
      setMeta('meta[property="og:image:alt"]', title);
      setMeta('meta[name="twitter:image:alt"]', title);
    }
    if (description) {
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
      setMeta('meta[name="description"]', description);
    }
  }

  function show(id) {
    ['state-loading', 'state-ok', 'state-invalid', 'state-unavailable'].forEach(function (name) {
      var node = document.getElementById(name);
      if (!node) return;
      node.hidden = name !== id;
      if (name === id) {
        node.setAttribute('aria-busy', name === 'state-loading' ? 'true' : 'false');
        if (name === 'state-loading') return;
        var active = document.activeElement;
        var keepFocus = core.keepLandingFocus(active);
        if (!keepFocus) {
          var action =
            name === 'state-unavailable'
              ? document.getElementById('unavailable-cta')
              : name === 'state-invalid'
                ? document.getElementById('invalid-home')
                : null;
          if (action) {
            action.focus({ preventScroll: true });
            return;
          }
          var heading = node.querySelector('h1');
          if (heading) heading.focus({ preventScroll: true });
        }
      }
    });
  }

  function setCodeBoxVisible(visible) {
    var box = document.getElementById('ok-code-box');
    if (box) box.hidden = !visible;
  }

  function setOpenVisible(visible) {
    var open = document.getElementById('ok-open');
    if (!open) return;
    var platform = document.documentElement.getAttribute('data-platform');
    open.hidden = !visible || (platform !== 'ios' && platform !== 'android');
  }

  document.documentElement.lang = lang;
  var pathIsPromo = /^\/+promo(\/|$)/i.test(window.location.pathname);
  var isPromoPath = parsed ? parsed.kind === 'promo' : pathIsPromo;
  document.title = isPromoPath ? copy['doc.title.promo'] : copy['doc.title.invite'];
  setText('loading-title', isPromoPath ? copy['loading.title.promo'] : copy['loading.title']);
  setText('loading-body', copy['loading.body']);
  setText('invalid-title', copy['invalid.title']);
  setText('invalid-body', copy['invalid.body']);
  setText('invalid-home', copy['invalid.home']);
  setText('unavailable-title', copy['unavailable.title']);
  setText('unavailable-body', copy['unavailable.body']);
  setText('unavailable-cta', copy['unavailable.cta']);
  setText('unavailable-home', copy['unavailable.home']);
  var homeHref = core.homeUrl(window.location.hostname);
  ['invalid-home', 'unavailable-home'].forEach(function (id) {
    var link = document.getElementById(id);
    if (link) link.setAttribute('href', homeHref);
  });
  setText('ok-cta', copy['cta']);
  setText('ok-desktop', copy['cta.desktop']);
  function setPitch(kind) {
    setText('ok-pitch', kind === 'promo' ? copy['promo.body.fallback'] : copy['invite.pitch']);
  }
  setPitch(parsed ? parsed.kind : isPromoPath ? 'promo' : 'invite');
  setText('ok-retap', copy['retap']);
  setText('ok-code-label', copy['code.label']);
  setText('ok-code-hint', copy['code.hint']);
  setText('ok-copy', copy['code.copy']);
  setText('ok-copy-link', copy['link.copy']);
  var descEl = document.querySelector('meta[name="description"]');
  if (descEl && copy['doc.desc']) descEl.setAttribute('content', copy['doc.desc']);
  setShareMeta(document.title, copy['doc.desc']);
  setCanonical(parsed ? parsed.kind : isPromoPath ? 'promo' : 'invite', parsed && parsed.code);
  setMeta('meta[property="og:locale"]', lang === 'en' ? 'en_GB' : 'de_CH');
  setMeta('meta[property="og:locale:alternate"]', lang === 'en' ? 'de_CH' : 'en_GB');
  var storesNav = document.querySelector('.stores');
  if (storesNav && copy['stores.nav']) {
    storesNav.setAttribute('aria-label', copy['stores.nav']);
  }
  var platform = document.documentElement.getAttribute('data-platform');
  document.querySelectorAll('a[data-store="apple"]').forEach(function (el) {
    if (copy['stores.apple.aria']) el.setAttribute('aria-label', copy['stores.apple.aria']);
    var img = el.querySelector('img');
    if (img) img.setAttribute('alt', '');
    if (platform === 'ios') el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('a[data-store="play"]').forEach(function (el) {
    if (copy['stores.play.aria']) el.setAttribute('aria-label', copy['stores.play.aria']);
    var img = el.querySelector('img');
    if (img) img.setAttribute('alt', '');
    if (platform === 'android') el.setAttribute('aria-current', 'true');
    else el.removeAttribute('aria-current');
  });

  if (!parsed) {
    setCodeBoxVisible(false);
    setOpenVisible(false);
    document.title = copy['invalid.title'];
    setShareMeta(copy['invalid.title'], copy['invalid.body']);
    setThemeColor(THEME_RED);
    show('state-invalid');
    return;
  }

  setText('ok-code', parsed.code);
  setCodeHint(copy['code.checking'], true);
  setCodeBoxVisible(true);
  setOpenVisible(false);
  hideLoading();
  var copyBtn = document.getElementById('ok-copy');
  var copyLinkBtn = document.getElementById('ok-copy-link');
  var codeEl = document.getElementById('ok-code');
  if (codeEl) {
    codeEl.setAttribute('title', copy['code.copy']);
    codeEl.setAttribute('role', 'button');
    codeEl.setAttribute('tabindex', '0');
    codeEl.setAttribute('aria-label', copy['code.label'] + ' ' + parsed.code);
  }
  var copyInFlight = { code: false, link: false };
  function copyControl(slot) {
    return slot === 'link' ? copyLinkBtn : copyBtn;
  }
  function setCopyBusy(slot, busy) {
    var btn = copyControl(slot);
    if (btn) {
      btn.disabled = !!busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (slot !== 'code' || !codeEl) return;
    codeEl.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) codeEl.setAttribute('aria-disabled', 'true');
    else codeEl.removeAttribute('aria-disabled');
  }
  function copyValue(value, onCopied, onFailed, slot) {
    slot = slot || 'code';
    if (copyInFlight[slot]) return;
    copyInFlight[slot] = true;
    setCopyBusy(slot, true);
    var fallback = function () {
      var area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.setAttribute('aria-hidden', 'true');
      area.setAttribute('tabindex', '-1');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = !!document.execCommand('copy');
      } catch (e) {
        ok = false;
      } finally {
        document.body.removeChild(area);
      }
      return ok;
    };
    var settled = false;
    var copyWait;
    var finish = function (ok) {
      if (settled) return;
      settled = true;
      if (copyWait) clearTimeout(copyWait);
      copyInFlight[slot] = false;
      setCopyBusy(slot, false);
      if (ok) onCopied();
      else if (onFailed) onFailed();
    };
    copyWait = setTimeout(function () {
      finish(fallback());
    }, core.COPY_TIMEOUT_MS);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(function () {
          finish(true);
        })
        .catch(function () {
          finish(fallback());
        });
    } else {
      finish(fallback());
    }
  }
  var lookupInFlight = false;
  var retry = document.getElementById('unavailable-cta');
  function setRetryBusy(busy) {
    if (!retry) return;
    retry.disabled = !!busy;
    retry.setAttribute('aria-busy', busy ? 'true' : 'false');
  }
  var copyAnnounced = false;
  function announceCopy(copied) {
    if (copied) {
      copyAnnounced = true;
      setCodeHint(copy['code.copied'], false);
      return;
    }
    if (!copyAnnounced) return;
    copyAnnounced = false;
    if (lookupInFlight) setCodeHint(copy['code.checking'], true);
    else setCodeHint(copy['code.hint'], false);
  }
  function setCopyState(copied) {
    var label = copied ? copy['code.copied'] : copy['code.copy'];
    if (copyBtn) {
      copyBtn.textContent = label;
      copyBtn.setAttribute('aria-label', label + ' ' + parsed.code);
      copyBtn.removeAttribute('aria-live');
    }
    if (codeEl) {
      codeEl.setAttribute(
        'aria-label',
        (copied ? copy['code.copied'] : copy['code.label']) + ' ' + parsed.code,
      );
    }
    announceCopy(copied);
  }
  setCopyState(false);
  var copyResetId;
  function copyCode() {
    if (copyInFlight.code) return;
    copyValue(
      parsed.code,
      function () {
        if (copyBtn) copyBtn.classList.remove('btn-copy-failed');
        if (codeEl) codeEl.classList.remove('code-copy-failed');
        setCopyState(true);
        window.clearTimeout(copyResetId);
        copyResetId = window.setTimeout(function () {
          setCopyState(false);
        }, 2000);
      },
      function () {
        if (copyBtn) copyBtn.classList.add('btn-copy-failed');
        if (codeEl) codeEl.classList.add('code-copy-failed');
        setCopyState(false);
        window.clearTimeout(copyResetId);
        copyResetId = window.setTimeout(function () {
          if (copyBtn) copyBtn.classList.remove('btn-copy-failed');
          if (codeEl) codeEl.classList.remove('code-copy-failed');
        }, 2000);
      },
      'code',
    );
  }
  if (copyBtn) copyBtn.addEventListener('click', copyCode);
  function copyLinkHref() {
    var canonical = document.querySelector('link[rel="canonical"]');
    return (
      (canonical && canonical.getAttribute('href')) ||
      window.location.origin + '/' + parsed.kind + '/' + encodeURIComponent(parsed.code)
    );
  }
  function setCopyLinkState(copied) {
    if (!copyLinkBtn) return;
    var label = copied ? copy['code.copied'] : copy['link.copy'];
    copyLinkBtn.textContent = label;
    copyLinkBtn.setAttribute('aria-label', label + ' ' + copyLinkHref());
    copyLinkBtn.removeAttribute('aria-live');
    announceCopy(copied);
  }
  setCopyLinkState(false);
  var copyLinkResetId;
  function copyLink() {
    copyValue(
      copyLinkHref(),
      function () {
        if (copyLinkBtn) copyLinkBtn.classList.remove('btn-copy-failed');
        setCopyLinkState(true);
        window.clearTimeout(copyLinkResetId);
        copyLinkResetId = window.setTimeout(function () {
          setCopyLinkState(false);
        }, 2000);
      },
      function () {
        if (copyLinkBtn) copyLinkBtn.classList.add('btn-copy-failed');
        setCopyLinkState(false);
        window.clearTimeout(copyLinkResetId);
        copyLinkResetId = window.setTimeout(function () {
          if (copyLinkBtn) copyLinkBtn.classList.remove('btn-copy-failed');
        }, 2000);
      },
      'link',
    );
  }
  if (copyLinkBtn) copyLinkBtn.addEventListener('click', copyLink);
  if (codeEl) {
    codeEl.addEventListener('click', copyCode);
    codeEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyCode();
      }
    });
  }

  var base = core.apiBase({ host: window.location.hostname, paramApi: params.get('api') });
  var url = core.buildLookupUrl(base, parsed.code);
  var appHref = core.openInAppUrl(
    parsed.kind,
    parsed.code,
    document.documentElement.getAttribute('data-platform'),
  );
  var cta = document.getElementById('ok-cta');
  if (cta) {
    cta.setAttribute('href', appHref);
    if (document.documentElement.getAttribute('data-platform') === 'ios') {
      cta.setAttribute('aria-describedby', 'ok-retap');
    }
  }
  var androidAlt = document.querySelector('link[rel="alternate"][data-android-app]');
  var iosAlt = document.querySelector('link[rel="alternate"][data-ios-app]');
  function ensureAltLink(existing, attr) {
    if (existing) return existing;
    var link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute(attr, '');
    document.head.appendChild(link);
    return link;
  }
  var handoffActive = false;
  function setShareAppLinks() {
    var href = core.landingCanonicalHref(window.location.hostname, parsed.kind, parsed.code);
    var scheme = core.appLink(parsed.kind, parsed.code);
    ensureMeta('meta[property="al:ios:url"]', 'property', 'al:ios:url').setAttribute(
      'content',
      scheme,
    );
    ensureMeta(
      'meta[property="al:ios:app_store_id"]',
      'property',
      'al:ios:app_store_id',
    ).setAttribute('content', '6759720010');
    ensureMeta('meta[property="al:ios:app_name"]', 'property', 'al:ios:app_name').setAttribute(
      'content',
      'RealUnit',
    );
    ensureMeta('meta[property="al:android:url"]', 'property', 'al:android:url').setAttribute(
      'content',
      scheme,
    );
    ensureMeta(
      'meta[property="al:android:package"]',
      'property',
      'al:android:package',
    ).setAttribute('content', 'swiss.realunit.app');
    ensureMeta('meta[property="al:android:class"]', 'property', 'al:android:class').setAttribute(
      'content',
      'swiss.realunit.app.MainActivity',
    );
    ensureMeta(
      'meta[property="al:android:app_name"]',
      'property',
      'al:android:app_name',
    ).setAttribute('content', 'RealUnit');
    ensureMeta('meta[property="al:web:url"]', 'property', 'al:web:url').setAttribute(
      'content',
      href,
    );
    ensureMeta(
      'meta[name="twitter:app:name:iphone"]',
      'name',
      'twitter:app:name:iphone',
    ).setAttribute('content', 'RealUnit');
    ensureMeta('meta[name="twitter:app:id:iphone"]', 'name', 'twitter:app:id:iphone').setAttribute(
      'content',
      '6759720010',
    );
    ensureMeta(
      'meta[name="twitter:app:url:iphone"]',
      'name',
      'twitter:app:url:iphone',
    ).setAttribute('content', scheme);
    ensureMeta('meta[name="twitter:app:name:ipad"]', 'name', 'twitter:app:name:ipad').setAttribute(
      'content',
      'RealUnit',
    );
    ensureMeta('meta[name="twitter:app:id:ipad"]', 'name', 'twitter:app:id:ipad').setAttribute(
      'content',
      '6759720010',
    );
    ensureMeta('meta[name="twitter:app:url:ipad"]', 'name', 'twitter:app:url:ipad').setAttribute(
      'content',
      scheme,
    );
    ensureMeta(
      'meta[name="twitter:app:name:googleplay"]',
      'name',
      'twitter:app:name:googleplay',
    ).setAttribute('content', 'RealUnit');
    ensureMeta(
      'meta[name="twitter:app:id:googleplay"]',
      'name',
      'twitter:app:id:googleplay',
    ).setAttribute('content', 'swiss.realunit.app');
    ensureMeta(
      'meta[name="twitter:app:url:googleplay"]',
      'name',
      'twitter:app:url:googleplay',
    ).setAttribute('content', scheme);
    ensureMeta('meta[name="twitter:app:country"]', 'name', 'twitter:app:country').setAttribute(
      'content',
      'CH',
    );
  }
  function clearShareAppLinks() {
    [
      'al:ios:url',
      'al:ios:app_store_id',
      'al:ios:app_name',
      'al:android:url',
      'al:android:package',
      'al:android:class',
      'al:android:app_name',
      'al:web:url',
    ].forEach(function (prop) {
      var el = document.querySelector('meta[property="' + prop + '"]');
      if (el) el.removeAttribute('content');
    });
    [
      'twitter:app:name:iphone',
      'twitter:app:id:iphone',
      'twitter:app:url:iphone',
      'twitter:app:name:ipad',
      'twitter:app:id:ipad',
      'twitter:app:url:ipad',
      'twitter:app:name:googleplay',
      'twitter:app:id:googleplay',
      'twitter:app:url:googleplay',
      'twitter:app:country',
    ].forEach(function (name) {
      var el = document.querySelector('meta[name="' + name + '"]');
      if (el) el.removeAttribute('content');
    });
  }
  function setInstallHandoff() {
    handoffActive = true;
    setMeta('meta[name="apple-itunes-app"]', core.itunesBanner(parsed.kind, parsed.code));
    androidAlt = ensureAltLink(androidAlt, 'data-android-app');
    androidAlt.setAttribute('href', core.androidAppUrl(parsed.kind, parsed.code));
    iosAlt = ensureAltLink(iosAlt, 'data-ios-app');
    iosAlt.setAttribute('href', core.iosAppUrl(parsed.kind, parsed.code));
    document.querySelectorAll('a[data-store="play"]').forEach(function (el) {
      el.setAttribute('href', core.playStoreUrl(parsed.code, parsed.kind));
    });
    setShareAppLinks();
  }
  function clearInstallHandoff() {
    handoffActive = false;
    setMeta('meta[name="apple-itunes-app"]', core.itunesBanner());
    document.querySelectorAll('a[data-store="play"]').forEach(function (el) {
      el.setAttribute('href', core.playStoreUrl());
    });
    if (androidAlt) androidAlt.removeAttribute('href');
    if (iosAlt) iosAlt.removeAttribute('href');
    clearShareAppLinks();
  }
  document.querySelectorAll('a[data-store="apple"]').forEach(function (el) {
    el.setAttribute('href', core.appStoreUrl());
  });
  // Store badges stay visible during lookup — attach the code now so a
  // Play/iTunes tap still carries it. Invalid lookup clears this.
  setInstallHandoff();
  // App Store has no Play referrer. Copy on the tap (user gesture) so a
  // badge/CTA install can still be pasted at registration (Offerte Punkt 3).
  function bindInstallHandoffCopy(el) {
    if (!el) return;
    el.addEventListener('click', function () {
      if (!handoffActive) return;
      copyCode();
    });
  }
  bindInstallHandoffCopy(cta);
  document
    .querySelectorAll('a[data-store="apple"], a[data-store="play"]')
    .forEach(bindInstallHandoffCopy);

  function render(result) {
    lookupInFlight = false;
    setRetryBusy(false);
    if (result.state === 'invalid') {
      var invalidCopy = core.invalidLandingCopy(result, copy);
      document.title = invalidCopy.title;
      setText('invalid-title', invalidCopy.title);
      setText('invalid-body', invalidCopy.body);
      setShareMeta(invalidCopy.title, invalidCopy.body);
      setThemeColor(THEME_RED);
      setCodeBoxVisible(false);
      setOpenVisible(false);
      clearInstallHandoff();
      setCodeHint(copy['code.hint'], false);
      show('state-invalid');
      return;
    }
    if (result.state === 'unavailable') {
      document.title = copy['unavailable.title'];
      setShareMeta(copy['unavailable.title'], copy['unavailable.body']);
      setThemeColor(THEME_BLUE);
      setPitch(parsed.kind);
      setCodeHint(copy['code.hint'], false);
      setCodeBoxVisible(true);
      setOpenVisible(true);
      setInstallHandoff();
      show('state-unavailable');
      return;
    }
    setThemeColor(THEME_BLUE);
    setCodeHint(copy['code.hint'], false);
    setInstallHandoff();
    setCodeBoxVisible(true);
    setOpenVisible(true);
    var payload = result.payload || {};
    var okTitleEl = document.getElementById('ok-title');
    var okBodyEl = document.getElementById('ok-body');
    function setNoTranslate(el, off) {
      if (!el) return;
      if (off) {
        el.setAttribute('translate', 'no');
        el.classList.add('notranslate');
      } else {
        el.removeAttribute('translate');
        el.classList.remove('notranslate');
      }
    }
    function setOkBody(text, sourceLang, lockTranslate) {
      setText('ok-body', text);
      if (!okBodyEl) return;
      if (sourceLang && sourceLang !== lang) okBodyEl.setAttribute('lang', sourceLang);
      else okBodyEl.removeAttribute('lang');
      setNoTranslate(okBodyEl, !!lockTranslate);
    }
    if (result.state === 'promo') {
      setPitch('promo');
      document.title = copy['doc.title.promo'];
      setText('ok-title', copy['promo.title']);
      setNoTranslate(okTitleEl, false);
      var promoText = String(core.promoBody(payload, lang) || '').trim();
      setOkBody(
        promoText || copy['promo.body.fallback'],
        promoText ? core.promoBodyLang(payload, lang) : lang,
        !!promoText,
      );
    } else {
      setPitch('invite');
      document.title = copy['doc.title.invite'];
      var invitee = core.personDisplayName(payload.inviteeName);
      setText(
        'ok-title',
        invitee
          ? core.interpolate(copy['invite.title'], { invitee: invitee })
          : copy['invite.title.fallback'],
      );
      setNoTranslate(okTitleEl, !!invitee);
      var inviter = core.personDisplayName(payload.inviterName);
      setOkBody(core.inviteLandingBody(payload, copy), lang, !!inviter);
    }
    show('state-ok');
    var okTitle = document.getElementById('ok-title');
    var okBody = document.getElementById('ok-body');
    setShareMeta(
      (okTitle && okTitle.textContent) || document.title,
      (okBody && okBody.textContent) || copy['doc.desc'],
    );
  }

  // Local preview only (?mock=1|invalid|spent|unavailable|loading|fallback).
  // Never honored on realunit.app / dev.realunit.app, so a shared prod link
  // cannot spoof state.
  var mock = params.get('mock');
  if (mock && !core.isRealUnitHost(window.location.hostname)) {
    if (mock === 'invalid') {
      render({ state: 'invalid' });
    } else if (mock === 'spent') {
      render({ state: 'invalid', code: 'SPENT' });
    } else if (mock === 'unavailable') {
      render({ state: 'unavailable' });
    } else if (mock === 'loading') {
      show('state-loading');
    } else if (mock === 'fallback') {
      render(core.mapResult(200, parsed.kind === 'promo' ? { kind: 'promo' } : { kind: 'invite' }));
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
    lookupCode();
  }

  var lookupAbort;
  var lookupTimeoutId;
  function lookupCode() {
    if (lookupAbort) lookupAbort.abort();
    clearTimeout(lookupTimeoutId);
    var unavailable = document.getElementById('state-unavailable');
    var retrying = !!(unavailable && !unavailable.hidden);
    lookupInFlight = true;
    setRetryBusy(true);
    if (!retrying) {
      document.title =
        parsed.kind === 'promo' ? copy['loading.title.promo'] : copy['loading.title'];
      setShareMeta(document.title, copy['loading.body']);
      setThemeColor(THEME_BLUE);
      setCodeHint(copy['code.checking'], true);
      setCodeBoxVisible(true);
      setOpenVisible(false);
      hideLoading();
      var active = document.activeElement;
      ['state-ok', 'state-invalid', 'state-unavailable'].forEach(function (name) {
        var node = document.getElementById(name);
        if (!node) return;
        node.hidden = true;
        node.setAttribute('aria-busy', 'false');
      });
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        (!active.isConnected || active.closest('[hidden]'))
      ) {
        var hint = document.getElementById('ok-code-hint');
        if (hint) hint.focus({ preventScroll: true });
      }
    } else {
      hideLoading();
    }

    var timedOut = false;
    lookupAbort =
      typeof AbortController === 'function'
        ? new AbortController()
        : { abort: function () {}, signal: undefined };
    var abort = lookupAbort;
    lookupTimeoutId = setTimeout(function () {
      timedOut = true;
      abort.abort();
      if (abort !== lookupAbort) return;
      // Budget elapsed — show Retry even if fetch abort is a no-op.
      render({ state: 'unavailable' });
    }, core.LOOKUP_TIMEOUT_MS);

    fetch(url, core.lookupFetchInit(abort.signal))
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
        if (abort !== lookupAbort || timedOut) return;
        clearTimeout(lookupTimeoutId);
        render(core.finalizeLookup(timedOut, r.status, r.body, parsed.kind));
      })
      .catch(function (err) {
        if (abort !== lookupAbort || timedOut) return;
        clearTimeout(lookupTimeoutId);
        if (err && err.name === 'AbortError') return;
        render({ state: 'unavailable' });
      });
  }

  if (retry) {
    retry.addEventListener('click', function () {
      if (lookupInFlight) return;
      lookupCode();
    });
  }
})();
