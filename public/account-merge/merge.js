/* DOM + network glue for the account-merge confirmation page. The pure,
   testable logic (language resolution, host/API-base derivation, response → state
   mapping, and the i18n copy) lives in js/lib/merge-core.js, loaded before this
   file; everything here touches the DOM/network and is covered by the Playwright
   functional suite. */
(function () {
  'use strict';

  var core = window.RealUnitMerge;
  var params = new URLSearchParams(window.location.search);
  var host = window.location.hostname;

  var lang = core.resolveLang({
    urlLang: params.get('lang'),
    navigatorLang: navigator.language,
    supported: core.SUPPORTED_LANGS,
    defaultLang: 'de',
  });
  document.documentElement.lang = lang;
  var t = core.I18N[lang];

  // Apply translations: text content, alt text, aria-label, and document meta.
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var v = t[el.getAttribute('data-i18n')];
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
    var v = t[el.getAttribute('data-i18n-alt')];
    if (v) el.setAttribute('alt', v);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
    var v = t[el.getAttribute('data-i18n-aria')];
    if (v) el.setAttribute('aria-label', v);
  });
  if (t['doc.title']) document.title = t['doc.title'];
  var descEl = document.querySelector('meta[name="description"]');
  if (descEl && t['doc.desc']) descEl.setAttribute('content', t['doc.desc']);

  // The return-to-app hand-off uses a fixed custom URL scheme,
  // realunit-wallet://open, hard-coded on the button in the markup — no host
  // derivation needed. realunit.app claims no Universal/App Link, so the
  // merge email always reaches this web page; the app registers the scheme
  // to re-open itself after confirmation. This page never redirects.

  var STATES = ['loading', 'confirmed', 'already-completed', 'invalid', 'unavailable'];
  function show(state) {
    STATES.forEach(function (s) {
      document.getElementById('state-' + s).hidden = s !== state;
    });
  }

  // The confirmed / already-completed copy is chosen purely in CSS from
  // html[data-platform] (set by platform.js before first paint): a phone gets
  // the "back to the app" button (the realunit-wallet:// scheme only resolves
  // on the device), while a desktop — where the scheme opens nothing — is told
  // to return on its phone.
  function render(status) {
    if (status === 'confirmed') {
      show('confirmed');
    } else if (status === 'already-completed') {
      show('already-completed');
    } else if (status === 'invalid') {
      show('invalid');
    } else if (status === 'unavailable') {
      show('unavailable');
    } else {
      show('unavailable');
    }
  }

  // Parse JSON; on failure still return the HTTP status with an empty body so
  // mapHttpToState can decide from the status alone.
  function parseJsonBody(res) {
    return res
      .json()
      .then(function (body) {
        return { status: res.status, body: body };
      })
      .catch(function () {
        return { status: res.status, body: {} };
      });
  }

  // Poll a DFX async job until it is terminal or the budget expires. Keeps the
  // loading state visible; there is no state-job UI.
  function pollJob(base, jobBody, otp) {
    var uid = jobBody.uid;
    var budgetSec =
      typeof jobBody.expectedSeconds === 'number' && jobBody.expectedSeconds > 0
        ? jobBody.expectedSeconds
        : 60;
    var budgetMs = budgetSec * 1000;
    var started = Date.now();

    function tick() {
      if (Date.now() - started >= budgetMs) {
        render('unavailable');
        return;
      }
      setTimeout(function () {
        if (Date.now() - started >= budgetMs) {
          render('unavailable');
          return;
        }
        fetch(core.buildJobUrl(base, uid), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        })
          .then(function (res) {
            return res
              .json()
              .then(function (body) {
                return body;
              })
              .catch(function () {
                // JSON failure on a poll is treated as unavailable.
                throw new Error('job-json');
              });
          })
          .then(function (body) {
            var status = body && body.status;
            if (core.isJobTerminal(status)) {
              if (status === 'Complete') {
                // Job finished: re-run the mail-confirm call with the same OTP.
                fetchConfirm(base, otp);
              } else {
                // Failed or DeadLetter.
                render('unavailable');
              }
            } else {
              // Pending / Processing / Retry / unknown — keep polling.
              tick();
            }
          })
          .catch(function () {
            render('unavailable');
          });
      }, 1000);
    }

    tick();
  }

  function fetchConfirm(base, otp) {
    // Abort a stalled request so the spinner can never hang forever.
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, 15000);

    fetch(core.buildConfirmUrl(base, otp), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
    })
      .then(function (res) {
        return parseJsonBody(res);
      })
      .then(function (r) {
        clearTimeout(timeoutId);
        var state = core.mapHttpToState(r.status, r.body);
        if (state === 'job') {
          // Keep showing loading while the job is polled; no state-job UI.
          pollJob(base, r.body, otp);
        } else {
          render(state);
        }
      })
      .catch(function () {
        clearTimeout(timeoutId);
        // Network error / timeout (abort) → retryable. Never call mapHttpToState
        // without an HTTP status.
        render('unavailable');
      });
  }

  function confirm() {
    show('loading');

    // Mock hook for LOCAL preview only (?mock=confirmed|already-completed|
    // invalid|unavailable|loading). Never honored on the real realunit.app /
    // dev.realunit.app hosts, so a shared prod link cannot render a spoofed
    // confirmation screen.
    var mock = params.get('mock');
    if (mock && !core.isRealUnitHost(host)) {
      setTimeout(function () {
        if (mock === 'loading') {
          // Stay on the loading state after the short delay.
          return;
        }
        render(mock);
      }, 400);
      return;
    }

    var otp = params.get('otp');
    if (!core.hasOtp(otp)) {
      show('invalid');
      return;
    }

    var base = core.apiBase({ host: host, paramApi: params.get('api') });
    fetchConfirm(base, otp);
  }

  document.getElementById('retry').addEventListener('click', confirm);
  confirm();
})();
