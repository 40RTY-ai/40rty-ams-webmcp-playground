/**
 * The visible tool inspector: a panel that lists the registered WebMCP tools
 * and logs every call as it lands.
 *
 * This is the highest-leverage thing in the repo. WebMCP is invisible by
 * nature — a judge who opens the page without an agent attached sees a
 * storefront and no evidence of a protocol. The panel turns "trust us, tools
 * are registered" into something a human can read in one glance, and while an
 * agent drives the page it shows causality: the sentence went to ChatGPT, and
 * `send_message` fired here.
 *
 * Renders into the host page's light DOM. The AMS embed lives in a shadow root
 * with its own stylesheet, so the two cannot collide.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  var MODE_LABEL = {
    native: 'native host · wrapped',
    polyfill: 'page polyfill',
    blocked: 'host locked · not instrumented',
    unsupported: 'no host',
    uninstalled: 'not installed'
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clockOf(ms) {
    var d = new Date(ms);
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /** Copy helper. The clipboard API needs a secure context; degrade honestly. */
  function copy(text, button, doneLabel) {
    var original = button.textContent;
    function ok() {
      button.textContent = doneLabel;
      button.classList.add('pgi-btn--done');
      setTimeout(function () {
        button.textContent = original;
        button.classList.remove('pgi-btn--done');
      }, 1800);
    }
    if (!navigator.clipboard) {
      button.textContent = 'clipboard unavailable (needs https)';
      setTimeout(function () { button.textContent = original; }, 2200);
      return;
    }
    navigator.clipboard.writeText(text).then(ok, function (err) {
      console.warn('[playground] copy failed:', err);
      button.textContent = 'copy failed';
      setTimeout(function () { button.textContent = original; }, 2200);
    });
  }

  /**
   * Where the panel sits, from `?inspector=`. `off` suppresses it entirely —
   * for a clean storefront-only shot, since the panel is demo chrome and the
   * composed layout is the product.
   */
  function placement() {
    var value = new URLSearchParams(window.location.search).get('inspector');
    if (value === 'off' || value === '0') return 'off';
    if (value === 'left') return 'left';
    return 'right';
  }

  function mount(options) {
    var opts = options === undefined ? {} : options;
    var api = window.PlaygroundWebMCP;
    if (!api) {
      console.error('[playground] inspector: PlaygroundWebMCP missing — load webmcp-host.js first.');
      return null;
    }

    var side = placement();
    if (side === 'off') return null;

    var root = el('div', side === 'left' ? 'pgi pgi--left' : 'pgi');
    root.setAttribute('role', 'complementary');
    root.setAttribute('aria-label', 'WebMCP tool inspector');

    // --- header: the self-announcing banner ---
    var head = el('div', 'pgi-head');
    var dot = el('span', 'pgi-dot');
    var title = el('span', 'pgi-title');
    var modeBadge = el('span', 'pgi-mode');
    var caret = el('span', 'pgi-caret', '▾');
    head.appendChild(dot);
    head.appendChild(title);
    head.appendChild(modeBadge);
    head.appendChild(caret);
    root.appendChild(head);

    var body = el('div', 'pgi-body');
    root.appendChild(body);

    // --- tabs ---
    var tabs = el('div', 'pgi-tabs');
    var tabTools = el('button', 'pgi-tab', 'Tools');
    var tabCalls = el('button', 'pgi-tab', 'Calls');
    tabTools.type = 'button';
    tabCalls.type = 'button';
    tabs.appendChild(tabTools);
    tabs.appendChild(tabCalls);
    body.appendChild(tabs);

    var scroll = el('div', 'pgi-scroll');
    body.appendChild(scroll);

    // --- footer: operator prompt + this brand's starter prompts ---
    var foot = el('div', 'pgi-foot');
    var promptApi = window.PlaygroundOperatorPrompt;
    if (promptApi) {
      var copyContract = el('button', 'pgi-btn pgi-btn--wide', '⧉ Copy agent instructions');
      copyContract.type = 'button';
      copyContract.title =
        'The operating contract plus the AMS guide — what this site is, which tool does ' +
        'which job, and how to phrase a request. Paste into a JS-capable browser agent.';
      copyContract.addEventListener('click', function () {
        copy(promptApi.text, copyContract, '✓ agent instructions copied');
      });
      foot.appendChild(copyContract);
    }
    var starters = opts.brand && opts.brand.prompts ? opts.brand.prompts : [];
    for (var s = 0; s < starters.length; s++) {
      (function (text) {
        var btn = el('button', 'pgi-btn pgi-btn--wide', '“' + text + '”');
        btn.type = 'button';
        btn.title = 'Copy this starter prompt';
        btn.addEventListener('click', function () { copy(text, btn, '✓ copied'); });
        foot.appendChild(btn);
      })(starters[s]);
    }
    if (foot.childNodes.length > 0) body.appendChild(foot);

    // --- collapse ---
    // The home screen starts collapsed: the panel is fixed to a corner, so
    // expanded it sits on top of whatever is there — on the home that is an
    // intent card, and hiding one of the four choices to show a developer
    // panel is the wrong trade. Collapsed it still carries the banner, which
    // is what a reviewer with no agent needs to see.
    var collapsed = opts.collapsed === true;
    if (collapsed) root.classList.add('pgi--collapsed');
    head.addEventListener('click', function () {
      collapsed = !collapsed;
      root.classList.toggle('pgi--collapsed', collapsed);
      caret.textContent = collapsed ? '▸' : '▾';
    });
    caret.textContent = collapsed ? '▸' : '▾';

    // --- rendering ---
    var active = 'tools';

    function renderTools() {
      var tools = api.tools();
      scroll.textContent = '';
      if (tools.length === 0) {
        scroll.appendChild(
          el('div', 'pgi-empty', 'No tools registered yet — the storefront registers on mount.')
        );
        return;
      }
      for (var i = 0; i < tools.length; i++) {
        var tool = tools[i];
        var box = el('details', 'pgi-tool');
        var summary = el('summary');
        summary.appendChild(el('span', 'pgi-tool-name', tool.name));
        summary.appendChild(el('span', 'pgi-tool-hint', tool.description ? tool.description.slice(0, 64) : ''));
        box.appendChild(summary);
        var detail = el('div', 'pgi-tool-detail');
        detail.appendChild(el('p', null, tool.description || '(no description)'));
        var schema = el('div', 'pgi-kv');
        schema.appendChild(el('b', null, 'inputSchema '));
        schema.appendChild(document.createTextNode(safeJson(tool.inputSchema)));
        detail.appendChild(schema);
        box.appendChild(detail);
        scroll.appendChild(box);
      }
    }

    function safeJson(value) {
      try {
        return JSON.stringify(value, null, 2);
      } catch (err) {
        return String(value);
      }
    }

    function renderCalls() {
      var log = api.calls();
      scroll.textContent = '';
      if (log.length === 0) {
        scroll.appendChild(
          el('div', 'pgi-empty', 'No calls yet. Ask the agent for something and watch them land here.')
        );
        return;
      }
      // Newest first: during a demo the interesting call is the one that just
      // fired, and the panel is short.
      for (var i = log.length - 1; i >= 0; i--) {
        var call = log[i];
        var row = el('div', 'pgi-call pgi-call--' + call.status);
        var top = el('div', 'pgi-call-top');
        top.appendChild(el('span', 'pgi-call-name', call.name));
        top.appendChild(el('span', 'pgi-call-src', call.source === 'agent' ? '· agent' : '· js client'));
        var timing =
          call.status === 'running' ? '…' : call.durationMs + 'ms';
        top.appendChild(el('span', 'pgi-call-ms', clockOf(call.startedAt) + ' · ' + timing));
        row.appendChild(top);

        if (call.args !== undefined && call.args !== '{}') {
          var argsLine = el('div', 'pgi-kv');
          argsLine.appendChild(el('b', null, 'args '));
          argsLine.appendChild(document.createTextNode(call.args));
          row.appendChild(argsLine);
        }
        if (call.status === 'ok' && call.result !== undefined) {
          var resLine = el('div', 'pgi-kv');
          resLine.appendChild(el('b', null, '→ '));
          resLine.appendChild(document.createTextNode(call.result));
          row.appendChild(resLine);
        }
        if (call.status === 'error') {
          var errLine = el('div', 'pgi-kv');
          errLine.appendChild(el('b', null, '✕ '));
          errLine.appendChild(document.createTextNode(call.error === undefined ? 'failed' : call.error));
          row.appendChild(errLine);
        }
        scroll.appendChild(row);
      }
    }

    function renderHeader() {
      var mode = api.mode();
      var count = api.tools().length;
      var live = mode === 'native' || mode === 'polyfill';
      dot.classList.toggle('pgi-dot--warn', !live);
      title.textContent = live
        ? 'WebMCP active · ' + count + (count === 1 ? ' tool' : ' tools') + ' registered'
        : 'WebMCP host unavailable';
      modeBadge.textContent = MODE_LABEL[mode] === undefined ? mode : MODE_LABEL[mode];
      tabCalls.textContent = 'Calls (' + api.calls().length + ')';
      tabTools.setAttribute('aria-selected', active === 'tools' ? 'true' : 'false');
      tabCalls.setAttribute('aria-selected', active === 'calls' ? 'true' : 'false');
    }

    function render() {
      renderHeader();
      if (active === 'tools') renderTools();
      else renderCalls();
    }

    function select(which) {
      active = which;
      render();
    }
    tabTools.addEventListener('click', function () { select('tools'); });
    tabCalls.addEventListener('click', function () { select('calls'); });

    api.subscribe(function (type) {
      // A call landing is the moment worth showing, so the first one pulls the
      // panel onto the Calls tab. After that the reviewer's choice is left alone.
      if (type === 'call:start' && active === 'tools' && api.calls().length === 1) active = 'calls';
      render();
    });

    document.body.appendChild(root);
    render();
    return { render: render, element: root };
  }

  window.PlaygroundInspector = { mount: mount };
})();
