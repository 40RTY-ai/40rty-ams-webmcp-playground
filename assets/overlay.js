/**
 * The overlay: the first thing a visitor sees, on top of the real storefront.
 *
 * It has one job — get someone from "I opened a URL" to "an agent is driving
 * this store" without them reading a README. So it says what the page is, hands
 * over the prompt, and gets out of the way. It stays dismissed once dismissed.
 *
 * Everything here is built from script after load. Injecting markup into a
 * server-rendered Next page breaks hydration (React #418), so the storefront
 * must never see an element it did not render itself.
 *
 * CLASSIC SCRIPT — see the ordering note in proxy-boot.js.
 */
(function () {
  'use strict';

  var DISMISSED_KEY = 'ams-demo-overlay-dismissed';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** localStorage throws in some contexts; a preference is never worth a crash. */
  function remembered(key) {
    try { return window.localStorage.getItem(key) === '1'; } catch (err) { return false; }
  }
  function remember(key) {
    try { window.localStorage.setItem(key, '1'); } catch (err) { /* nothing to do */ }
  }

  function demoPrompt() {
    if (window.PlaygroundDemo) return window.PlaygroundDemo.prompt();
    if (window.PlaygroundOperatorPrompt) return window.PlaygroundOperatorPrompt.text;
    return '';
  }

  function copy(text, button, doneLabel) {
    var original = button.textContent;
    function restore() { button.textContent = original; button.classList.remove('pgo-btn--done'); }
    if (!navigator.clipboard) {
      button.textContent = 'Clipboard needs https or localhost';
      setTimeout(restore, 2600);
      return;
    }
    navigator.clipboard.writeText(text).then(function () {
      button.textContent = doneLabel;
      button.classList.add('pgo-btn--done');
      setTimeout(restore, 2600);
    }, function (err) {
      console.warn('[demo] copy failed:', err);
      button.textContent = 'Copy failed — see the console';
      setTimeout(restore, 2600);
    });
  }

  function step(n, strong, rest, code) {
    var li = el('li', 'pgo-step');
    li.appendChild(el('span', 'pgo-step-n', String(n)));
    var body = el('div');
    var b = el('b', null, strong);
    body.appendChild(b);
    body.appendChild(document.createTextNode(' ' + rest));
    if (code) {
      body.appendChild(document.createTextNode(' '));
      body.appendChild(el('code', null, code));
    }
    li.appendChild(body);
    return li;
  }

  function build() {
    var scrim = el('div', 'pgo-scrim');
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-label', 'About this demo');

    var panel = el('div', 'pgo');

    var head = el('div', 'pgo-head');
    head.appendChild(el('p', 'pgo-eyebrow', 'WebMCP × AMS · Steve Madden'));
    head.appendChild(el('h1', 'pgo-h1', 'WebMCP lets an agent act. AMS gives it something worth building.'));

    var lede1 = el('p', 'pgo-lede');
    lede1.appendChild(document.createTextNode('WebMCP is the browser API that lets a page declare its own tools on '));
    lede1.appendChild(el('code', null, 'navigator.modelContext'));
    lede1.appendChild(document.createTextNode(' — so an agent calls what a site offers instead of ' +
      'guessing at its buttons. This page declares '));
    lede1.appendChild(el('strong', null, 'nineteen of them'));
    lede1.appendChild(document.createTextNode(', and the panel in the corner logs every call as it lands.'));
    head.appendChild(lede1);

    var lede2 = el('p', 'pgo-lede');
    lede2.appendChild(document.createTextNode('Point an agent at an ordinary storefront, though, and those tools are ' +
      'only a better remote control for a page someone authored months ago. '));
    lede2.appendChild(el('strong', null, 'This store has no authored pages.'));
    lede2.appendChild(document.createTextNode(' It composes itself around what you ask for — a real catalogue, the ' +
      'brand’s own AI, and a layout that did not exist before your sentence. What you can ' +
      'see behind this panel is the store’s own default page. Everything after it is built.'));
    head.appendChild(lede2);

    var lede3 = el('p', 'pgo-lede');
    lede3.appendChild(document.createTextNode('So the tools stop being a remote control and become a conversation ' +
      'with something that rebuilds. Change the palette and the occasion holds. Change the ' +
      'venue and the palette survives. '));
    lede3.appendChild(el('strong', null, 'The agent is not navigating a store — it is helping compose one.'));
    lede3.appendChild(document.createTextNode(' That is the combination.'));
    head.appendChild(lede3);
    panel.appendChild(head);

    var body = el('div', 'pgo-body');
    var steps = el('ol', 'pgo-steps');
    steps.appendChild(step(1, 'Copy the prompt', 'below. It tells your agent what this store is and gives it a five-beat demo to run.'));
    steps.appendChild(step(2, 'Paste it into your agent', '— Codex, ChatGPT, or anything that can drive a browser tab — with this tab active.'));
    steps.appendChild(step(3, 'Watch this page, not the chat.', 'The store rebuilds as the agent talks to it. Each rebuild is a WebMCP call you can watch land in the corner panel — the protocol made visible.'));
    steps.appendChild(step(4, 'Then go off-script.', 'Ask it for anything — a different occasion, a budget, a colour. Nothing here was rehearsed for it, which is the real test.'));
    body.appendChild(steps);
    panel.appendChild(body);

    var actions = el('div', 'pgo-actions');

    var copyBtn = el('button', 'pgo-btn pgo-btn--primary', 'Copy the demo prompt');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      var text = demoPrompt();
      if (text.length === 0) {
        copyBtn.textContent = 'Prompt unavailable — see the console';
        console.error('[demo] no prompt available; demo-script.js may not have loaded.');
        return;
      }
      copy(text, copyBtn, '✓ Copied — paste it into your agent');
    });
    actions.appendChild(copyBtn);

    var close = el('button', 'pgo-btn', 'Show me the store');
    close.type = 'button';
    close.addEventListener('click', function () { dismiss(scrim, false); });
    actions.appendChild(close);
    panel.appendChild(actions);

    var foot = el('div', 'pgo-foot');
    foot.appendChild(document.createTextNode('No agent to hand? Everything here is callable from the console: '));
    foot.appendChild(el('code', null, 'await window.webmcp.listTools()'));
    foot.appendChild(document.createTextNode('. Start with '));
    foot.appendChild(el('code', null, 'how_to_use_this_site'));
    foot.appendChild(document.createTextNode('. For the store with no opening prompt, add '));
    foot.appendChild(el('code', null, '?plain=1'));
    foot.appendChild(document.createTextNode('.'));
    panel.appendChild(foot);

    scrim.appendChild(panel);

    // Clicking the backdrop dismisses, but only the backdrop — a stray click
    // inside the panel should never close what someone is reading.
    scrim.addEventListener('click', function (event) {
      if (event.target === scrim) dismiss(scrim, false);
    });
    return scrim;
  }

  function tab() {
    var button = el('button', 'pgo-tab', 'ⓘ  about this demo');
    button.type = 'button';
    button.addEventListener('click', function () {
      button.remove();
      document.body.appendChild(build());
    });
    return button;
  }

  /** `permanent` records the choice; a plain close only affects this load. */
  function dismiss(scrim, permanent) {
    scrim.remove();
    if (permanent) remember(DISMISSED_KEY);
    document.body.appendChild(tab());
  }

  function mount() {
    // The inspector lives on the storefront now that everything is one origin.
    // Collapsed, because the store is the thing worth looking at.
    if (window.PlaygroundInspector) window.PlaygroundInspector.mount({ collapsed: true });

    // Register the demo's own tools alongside the storefront's, so an agent can
    // read the script and the guide from the page it is already driving. The
    // description decorator is NOT set here — see proxy-boot.js for why.
    if (window.PlaygroundAmsGuide && window.PlaygroundWebMCP) {
      window.PlaygroundAmsGuide.registerTool(window.PlaygroundWebMCP, 'space');
    }
    if (window.PlaygroundDemo && window.PlaygroundWebMCP) {
      // navigational: false — the storefront IS this page, so there is nothing
      // for a start_demo tool to navigate to.
      window.PlaygroundDemo.registerTool(window.PlaygroundWebMCP, window.PlaygroundIntents, { navigational: false });
    }

    if (remembered(DISMISSED_KEY)) {
      document.body.appendChild(tab());
      return;
    }
    document.body.appendChild(build());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
