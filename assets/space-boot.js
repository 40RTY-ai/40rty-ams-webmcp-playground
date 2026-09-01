/**
 * Boots one brand's space page.
 *
 * The ordering here is the whole trick, and it is why this is imperative rather
 * than declarative markup:
 *
 *   1. Install the instrumented WebMCP host.
 *   2. Create the embed's mount element with this brand's slug.
 *   3. Mount the inspector.
 *   4. ONLY THEN inject the AMS embed loader.
 *
 * Step 4 last means the embed cannot possibly register before our host exists,
 * so no registration is ever missed by the inspector and the embed's own host
 * no-ops (it declines to override a present host). Injecting the loader from
 * script rather than a static <script src> also lets `?api=` retarget the API
 * and the loader together — a staging or cold-machine check needs both to
 * move, and a hardcoded src would silently keep pointing at the default.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  var brands = window.PlaygroundBrands;
  var host = window.PlaygroundWebMCP;
  var inspector = window.PlaygroundInspector;

  if (!brands || !host || !inspector) {
    console.error('[playground] boot aborted — a required script did not load.');
    return;
  }

  // Install first, before anything can register.
  host.install();

  var brand = brands.current();

  if (brand === null) {
    var missing = document.createElement('div');
    missing.className = 'pg-missing';
    var h1 = document.createElement('h1');
    h1.textContent = 'No such space';
    var p = document.createElement('p');
    p.textContent = 'That path does not match a brand. Pick one from the launcher.';
    var back = document.createElement('p');
    var link = document.createElement('a');
    link.href = '/';
    link.textContent = '← All brands';
    back.appendChild(link);
    missing.appendChild(h1);
    missing.appendChild(p);
    missing.appendChild(back);
    document.body.appendChild(missing);
    // Still mount the inspector: an empty-but-honest panel beats a blank page
    // when someone is trying to work out why nothing registered.
    inspector.mount({});
    return;
  }

  document.title = brand.name + ' · 40rty AMS · WebMCP';
  document.documentElement.style.setProperty('--pg-accent', brand.accent);
  document.documentElement.style.setProperty('--pg-accent-text', brand.accentText);

  // --- slim brand bar ---
  var bar = document.createElement('div');
  bar.className = 'pg-bar';

  var home = document.createElement('a');
  home.href = '/';
  home.textContent = '←';
  home.title = 'All brands';
  bar.appendChild(home);

  var name = document.createElement('span');
  name.className = 'pg-bar-name';
  name.textContent = brand.name;
  bar.appendChild(name);

  var cat = document.createElement('span');
  cat.className = 'pg-bar-cat';
  cat.textContent = brand.category;
  bar.appendChild(cat);

  // The public storefront, not the internal space id — this bar is on screen
  // in every demo frame, and the brand's own domain is the useful signal.
  var right = document.createElement('span');
  right.className = 'pg-bar-right pg-mono';
  right.textContent = brand.site;
  bar.appendChild(right);

  document.body.appendChild(bar);

  // --- the embed mount ---
  var stage = document.createElement('div');
  stage.className = 'pg-stage';
  stage.setAttribute('data-fourty-spacefront', '');
  stage.setAttribute('data-space-slug', brand.slug);
  stage.setAttribute('data-api-url', brands.apiUrl());
  document.body.appendChild(stage);

  /**
   * Hold agent-backed calls until the space can actually serve them.
   *
   * The tools register as soon as the storefront mounts, which is before its
   * session is established. A prompt sent in that window is queued by the
   * client and fires later — but the awaiting call returns immediately with an
   * empty response, so an agent is told the turn is "done" and has no prose to
   * relay. The layout then updates a beat later, with nothing said about it.
   * That window is small, and it is exactly where a reviewer's FIRST prompt
   * lands, which makes it the worst possible thing to leave unhandled.
   *
   * So: before an agent-backed call runs, poll the space's own `get_status`
   * tool until it reports a session id. Read tools and actions are unaffected.
   * The wait shows up inside that call's duration in the inspector, which is
   * honest — the agent really did wait.
   */
  var AGENT_BACKED = { send_message: true, show_collection: true };
  var READY_TIMEOUT_MS = 25000;
  var POLL_MS = 250;

  function sessionReady() {
    var startedAt = Date.now();
    return new Promise(function (resolve, reject) {
      function check() {
        host.peek('get_status', {}).then(
          function (status) {
            var id = status === null || status === undefined ? null : status.sessionId;
            if (typeof id === 'string' && id.length > 0) return resolve();

            // A session-level error with NO session id is terminal: the space
            // could not open a channel at all (a locked space, for instance).
            // Reject rather than send. Sending anyway looks forgiving and is
            // the worst option available — the prompt gets queued against a
            // session that will never exist, so the call never settles and the
            // agent waits forever with nothing to report. Failing here costs a
            // second and produces a sentence the agent can actually relay.
            var failure = status === null || status === undefined ? null : status.error;
            if (typeof failure === 'string' && failure.length > 0) {
              return reject(new Error(
                'This space has no live session (' + failure + '), so its AI cannot be reached. ' +
                'It may be locked or temporarily unavailable. Nothing was sent — report this ' +
                'and stop rather than retrying.'
              ));
            }

            if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
              return reject(new Error(
                'This space did not establish a session within ' + Math.round(READY_TIMEOUT_MS / 1000) +
                's, so its AI cannot be reached. Nothing was sent — report this and stop rather ' +
                'than retrying.'
              ));
            }
            setTimeout(check, POLL_MS);
          },
          function (err) {
            // get_status is missing or disabled for this space, so readiness
            // cannot be observed. Proceed once the timeout elapses rather than
            // blocking a space that simply does not expose status.
            if (Date.now() - startedAt >= READY_TIMEOUT_MS) {
              console.warn('[playground] cannot read session status; sending anyway:', err);
              return resolve();
            }
            setTimeout(check, POLL_MS);
          }
        );
      }
      check();
    });
  }

  host.setPrecondition(function (name) {
    return AGENT_BACKED[name] === true ? sessionReady() : null;
  });

  // Must be installed before the embed registers anything, so its tools carry
  // the notes on their FIRST discovery pass rather than a later one.
  if (window.PlaygroundAmsGuide) {
    host.setDescriptionDecorator(window.PlaygroundAmsGuide.decorateDescription);
  }

  // --- the guide, registered as a tool so listTools() reveals it ---
  if (window.PlaygroundAmsGuide) window.PlaygroundAmsGuide.registerTool(host, 'space');

  // --- inspector, before the loader so the very first registration is seen ---
  inspector.mount({ brand: brand });

  // --- the AMS embed: React, the SDK, the component library and the compiled
  //     stylesheet all ride inside this one bundle. It boots on DOMContentLoaded
  //     when it lands during parse, and immediately when it lands after. ---
  var script = document.createElement('script');
  script.src = brands.loaderUrl();
  script.async = false;
  script.addEventListener('error', function () {
    console.error('[playground] embed loader failed to load from ' + script.src);
    // Say so on the page, not just in the console. A storefront that fails to
    // load is otherwise an empty white rectangle, which during a demo reads as
    // "this is broken and nobody noticed" rather than "the API is unreachable".
    var notice = document.createElement('div');
    notice.className = 'pg-missing';
    var head = document.createElement('h1');
    head.textContent = 'The storefront could not load';
    var why = document.createElement('p');
    why.textContent = 'The AMS embed did not load from ' + script.src + '.';
    var fix = document.createElement('p');
    fix.textContent =
      'Check that the API base in assets/config.js is reachable, and that this origin is ' +
      'accepted by it. A ?api= override can point somewhere else.';
    notice.appendChild(head);
    notice.appendChild(why);
    notice.appendChild(fix);
    stage.appendChild(notice);
  });
  document.body.appendChild(script);
})();
