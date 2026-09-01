/**
 * Installs the instrumented WebMCP host on the proxied storefront, in <head>,
 * before the storefront's own registration runs.
 *
 * Order is the whole job. The storefront registers its sixteen tools when its
 * React app mounts, and its own polyfill host installs only if nothing is there
 * already. Getting in first means every registration and every call passes
 * through our host, so the inspector sees the real surface — and the storefront
 * behaves exactly as it would otherwise, because our host forwards to any real
 * host it finds and is otherwise indistinguishable from the one it replaced.
 *
 * CLASSIC SCRIPT in <head>, deliberately not deferred: a deferred script runs
 * after the document is parsed, which is too late.
 */
(function () {
  'use strict';

  if (!window.PlaygroundWebMCP) {
    console.error('[demo] webmcp-host.js did not load — the inspector will be empty.');
    return;
  }

  var mode = window.PlaygroundWebMCP.install();
  console.info('[demo] WebMCP host installed ahead of the storefront (' + mode + ').');

  // The description decorator has to be in place BEFORE the storefront
  // registers, or its tools carry no operating notes on the discovery pass that
  // matters. This is why it is set here and not in the overlay, which runs at
  // DOMContentLoaded — by then the registration has already happened.
  if (window.PlaygroundAmsGuide) {
    window.PlaygroundWebMCP.setDescriptionDecorator(window.PlaygroundAmsGuide.decorateDescription);
  } else {
    console.warn('[demo] ams-guide.js did not load — tool descriptions carry no operating notes.');
  }

  /**
   * Hold agent-backed calls until the storefront has a session.
   *
   * Its tools register the moment its React app mounts, and that is before the
   * session POST has returned. The window is small — the session usually
   * appears within a second — but the agent's FIRST call lands squarely in it,
   * and a cold send_message comes back
   * {status: "error", code: "TURN_FAILED", "no_response"}. Honest, and still
   * the worst possible first impression: the demo's opening beat fails and the
   * agent has to work out why.
   *
   * So: poll the storefront's own get_status until it reports a session, then
   * let the call through. Reads and cart verbs are untouched.
   */
  var AGENT_BACKED = { send_message: true, show_collection: true };
  var READY_TIMEOUT_MS = 25000;
  var POLL_MS = 250;

  function sessionReady() {
    var startedAt = Date.now();
    return new Promise(function (resolve, reject) {
      function check() {
        window.PlaygroundWebMCP.peek('get_status', {}).then(
          function (status) {
            var id = status === null || status === undefined ? null : status.sessionId;
            if (typeof id === 'string' && id.length > 0) return resolve();

            // A session-level error with no session is terminal — the space
            // could not open a channel at all. Fail with a sentence the agent
            // can relay rather than queueing against a session that will
            // never exist.
            var failure = status === null || status === undefined ? null : status.error;
            if (typeof failure === 'string' && failure.length > 0) {
              return reject(new Error(
                'This storefront has no live session (' + failure + '), so its AI cannot be ' +
                'reached. Nothing was sent — report this and stop rather than retrying.'
              ));
            }
            if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
              return reject(new Error(
                'The storefront did not establish a session within ' +
                Math.round(READY_TIMEOUT_MS / 1000) + 's. Nothing was sent.'
              ));
            }
            setTimeout(check, POLL_MS);
          },
          function () {
            if (Date.now() - startedAt >= READY_TIMEOUT_MS) return resolve();
            setTimeout(check, POLL_MS);
          }
        );
      }
      check();
    });
  }

  window.PlaygroundWebMCP.setPrecondition(function (name) {
    return AGENT_BACKED[name] === true ? sessionReady() : null;
  });

  /**
   * Shaped like the PlaygroundIntents API so shared code can be reused. The
   * proxy serves the storefront at the root, so an "open with this intent" URL
   * is just a local one — though the demo no longer needs it: every beat,
   * including the first, is a send_message on the page already open.
   */
  window.PlaygroundIntents = {
    all: [],
    byId: function () { return null; },
    maxChars: function () { return 1000; },
    storefrontUrl: function (intentText) {
      var text = typeof intentText === 'string' ? intentText.trim() : '';
      if (text.length === 0) return window.location.origin + '/';
      if (text.length > 1000) text = text.slice(0, 1000);
      return window.location.origin + '/?intent=' + encodeURIComponent(text);
    }
  };
})();
