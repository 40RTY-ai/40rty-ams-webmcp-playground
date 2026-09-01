/**
 * The home screen: what AMS is, and four ways into it.
 *
 * Every intent — the four offered and anything typed into "something else" —
 * becomes an opening prompt on the storefront URL. AMS auto-submits that
 * prompt on a new session, so a single click composes a storefront with
 * nothing typed and nothing clicked inside the store. That handoff is the
 * demo: the sentence goes in, and a store that did not exist comes back.
 *
 * The handoff is a full navigation to another origin rather than an iframe.
 * An iframe would register the storefront's tools inside the frame's document,
 * where a top-level agent cannot see them — which would quietly cost us the
 * entire point. A navigation hands the agent a document whose own tool surface
 * is the storefront's.
 *
 * This page carries its own WebMCP surface so the same journey is available to
 * an agent: read the guide, list the intents, start one.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  var intents = window.PlaygroundIntents;
  var host = window.PlaygroundWebMCP;
  var inspector = window.PlaygroundInspector;

  if (!intents || !host || !inspector) {
    console.error('[playground] home boot aborted — a required script did not load.');
    return;
  }

  host.install();

  /** Open the storefront with an opening prompt, in its own tab. */
  function go(text) {
    var url = intents.storefrontUrl(text);
    if (url.length === 0) return;
    var opened = window.open(url, '_blank', 'noopener');
    // A blocked popup must not lose the click — fall back to this tab.
    if (opened === null || opened === undefined) window.location.assign(url);
  }

  // --- intent cards ---
  var grid = document.getElementById('hm-intents');
  if (grid !== null) {
    for (var i = 0; i < intents.all.length; i++) {
      (function (intent) {
        // A real anchor, so middle-click and "open in new tab" behave. The
        // click handler only exists to keep one code path for navigation.
        var card = document.createElement('a');
        card.className = 'hm-intent';
        card.href = intents.storefrontUrl(intent.text);
        // Each intent gets its own tab: an opening prompt is only submitted on
        // a new session, and session state is per-tab, so reusing this tab
        // would restore the previous conversation and drop the new intent
        // without saying so. Verified — the second intent in one tab is
        // silently ignored.
        card.target = '_blank';
        card.rel = 'noopener';

        var tag = document.createElement('p');
        tag.className = 'hm-intent-tag';
        tag.textContent = intent.tag;
        card.appendChild(tag);

        var text = document.createElement('p');
        text.className = 'hm-intent-text';
        text.textContent = '“' + intent.text + '”';
        card.appendChild(text);

        var hint = document.createElement('p');
        hint.className = 'hm-intent-hint';
        hint.textContent = intent.hint;
        card.appendChild(hint);

        var go_ = document.createElement('span');
        go_.className = 'hm-intent-go';
        go_.textContent = 'Build my store →';
        card.appendChild(go_);

        grid.appendChild(card);
      })(intents.all[i]);
    }
  }

  // --- "something else" ---
  var form = document.getElementById('hm-other-form');
  var input = document.getElementById('hm-other-input');
  if (form !== null && input !== null) {
    // Cap at the source rather than truncating a link later — an over-long
    // intent is dropped silently by the storefront, so it must never be built.
    input.setAttribute('maxlength', String(intents.maxChars()));
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (text.length === 0) {
        input.focus();
        return;
      }
      go(text);
    });
  }

  // --- guided demo ---
  var demo = window.PlaygroundDemo;
  if (demo) {
    var titleEl = document.getElementById('hm-demo-title');
    var premiseEl = document.getElementById('hm-demo-premise');
    var goEl = document.getElementById('hm-demo-go');
    var beatsEl = document.getElementById('hm-demo-beats');

    if (titleEl !== null) titleEl.textContent = demo.data.title;
    if (premiseEl !== null) premiseEl.textContent = demo.data.premise;
    // The opening rides the URL: a send_message on a cold page returns empty
    // and composes nothing, which would make beat one look like a dud.
    var copyEl = document.getElementById('hm-demo-copy');
    if (copyEl !== null) {
      copyEl.addEventListener('click', function () {
        var text = demo.prompt();
        if (!navigator.clipboard) {
          copyEl.textContent = 'Clipboard needs https';
          setTimeout(function () { copyEl.textContent = '2 · Copy the agent prompt'; }, 2400);
          return;
        }
        navigator.clipboard.writeText(text).then(function () {
          copyEl.textContent = '✓ Copied — paste it into your agent';
          setTimeout(function () { copyEl.textContent = '2 · Copy the agent prompt'; }, 2600);
        }, function (err) {
          console.warn('[playground] copy failed:', err);
          copyEl.textContent = 'Copy failed';
          setTimeout(function () { copyEl.textContent = '2 · Copy the agent prompt'; }, 2400);
        });
      });
    }

    if (goEl !== null) {
      goEl.href = intents.storefrontUrl(demo.data.opening);
      goEl.target = '_blank';
      goEl.rel = 'noopener';
    }

    if (beatsEl !== null) {
      for (var b = 0; b < demo.data.beats.length; b++) {
        (function (beat) {
          var li = document.createElement('li');
          li.className = 'hm-demo-beat';

          var n = document.createElement('span');
          n.className = 'hm-demo-n';
          n.textContent = String(beat.n).padStart(2, '0');
          li.appendChild(n);

          var body = document.createElement('div');
          body.className = 'hm-demo-body';

          var say = document.createElement('p');
          say.className = 'hm-demo-say';
          say.textContent = '“' + beat.say + '”';
          body.appendChild(say);

          var watch = document.createElement('p');
          watch.className = 'hm-demo-watch';
          watch.textContent = beat.watch;
          body.appendChild(watch);

          // Beat 1 is a link, not a line to say, so it gets no copy button.
          if (beat.via === 'send_message') {
            var copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'hm-demo-copy';
            copy.textContent = 'Copy line';
            copy.addEventListener('click', function () {
              if (!navigator.clipboard) return;
              navigator.clipboard.writeText(beat.say).then(function () {
                copy.textContent = 'Copied';
                setTimeout(function () { copy.textContent = 'Copy line'; }, 1600);
              }, function () {});
            });
            body.appendChild(copy);
          }

          li.appendChild(body);
          beatsEl.appendChild(li);
        })(demo.data.beats[b]);
      }
    }
  }

  // --- the page's own tool surface ---

  if (window.PlaygroundAmsGuide) {
    host.setDescriptionDecorator(window.PlaygroundAmsGuide.decorateDescription);
    window.PlaygroundAmsGuide.registerTool(host, 'launcher');
  }

  host.registerTool({
    name: 'list_intents',
    description:
      'List the example shopping intents this page offers, each written the way a shopper ' +
      'actually talks — an occasion, a place, a season, a person. Useful for seeing the shape ' +
      'of request this storefront is built for. You are not limited to these: start_shopping ' +
      'takes any intent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    execute: function () {
      return Promise.resolve({
        count: intents.all.length,
        intents: intents.all.map(function (intent) {
          return { id: intent.id, occasion: intent.tag, intent: intent.text, why_it_is_interesting: intent.hint };
        }),
        note: 'Any of these can be passed to start_shopping, as can a different intent entirely.'
      });
    }
  });

  host.registerTool({
    name: 'start_shopping',
    description:
      "Open the Steve Madden storefront with a shopping intent and let its AI compose a store " +
      'for it. Pass either an id from list_intents or your own free-text intent — describe the ' +
      "shopper's situation (occasion, place, season, budget, who it is for, what they already " +
      'own) rather than keywords. This NAVIGATES to the storefront, which tears down this ' +
      "page's tools and registers the storefront's own (send_message, get_products, " +
      'add_to_cart and the rest). The intent is submitted automatically on arrival, so the ' +
      'first layout composes without any further call — it takes 10-20 seconds. After ' +
      'navigating, re-run discovery on the new page, read the AI\'s reply with get_messages, ' +
      'then refine with send_message. Call this ONCE to enter; every follow-up is a ' +
      'send_message, because an intent on the URL is ignored inside a live session.',
    inputSchema: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: "Free-text shopping intent, e.g. \"a winter work trip to Boston — I need boots and a clutch\"."
        },
        intent_id: {
          type: 'string',
          description: 'Id of a listed intent from list_intents, used when no free-text intent is given.',
          enum: intents.all.map(function (x) { return x.id; })
        }
      },
      additionalProperties: false
    },
    execute: function (params) {
      var given = params === null || params === undefined ? {} : params;
      var text = typeof given.intent === 'string' ? given.intent.trim() : '';

      if (text.length === 0 && typeof given.intent_id === 'string') {
        var found = intents.byId(given.intent_id);
        if (found === null) {
          return Promise.reject(new Error(
            'start_shopping: unknown intent_id "' + given.intent_id + '". Available: ' +
              intents.all.map(function (x) { return x.id; }).join(', ')
          ));
        }
        text = found.text;
      }
      if (text.length === 0) {
        return Promise.reject(new Error('start_shopping: pass "intent" (free text) or "intent_id".'));
      }

      var url = intents.storefrontUrl(text);
      // Navigate on a later task so this promise settles first — otherwise the
      // document is torn down before the caller receives a return value.
      setTimeout(function () { window.location.assign(url); }, 0);
      return Promise.resolve({
        status: 'navigating',
        intent: text,
        url: url,
        next: 'Wait for the new document (10-20s while the opening intent composes), re-run ' +
          'discovery, then read the reply with get_messages.',
        important: 'This is an OPENING only. Every follow-up goes through send_message on the ' +
          'storefront — a further intent on the URL is ignored inside a live session. To start ' +
          'a genuinely different shopping conversation, call clear_session first.'
      });
    }
  });

  if (demo) demo.registerTool(host, intents);

  inspector.mount({ collapsed: true });
})();
