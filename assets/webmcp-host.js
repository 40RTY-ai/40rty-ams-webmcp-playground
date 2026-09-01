/**
 * The instrumented WebMCP host — the piece that makes an invisible protocol
 * visible to a human reviewer.
 *
 * WHY THIS EXISTS, AND WHY IT WRAPS RATHER THAN REPLACES
 *
 * The AMS space embed registers its tools on `navigator.modelContext` the
 * moment it mounts, and separately ships a host that polyfills that API for
 * JS-eval agents — but that polyfill installs only when no host is present, and
 * it records nothing. So there are two distinct situations:
 *
 *   1. A REAL host is present (ChatGPT's browser, Chrome behind
 *      `#enable-webmcp-for-testing`, or a bridge extension). Replacing it would
 *      shadow the registry the agent actually reads — the tools would register
 *      into a dead object and the page would look broken to the agent. So we
 *      WRAP: every `registerTool` is recorded here AND forwarded to the real
 *      host, with `execute` instrumented on the way through. Tools reach the
 *      agent exactly as before; we just get to watch.
 *
 *   2. No host is present. Then we ARE the host, mimicking the embed host's
 *      semantics precisely — `InvalidStateError` on duplicate registration and
 *      on unregistering an unknown tool — because the embed's registration
 *      catches those specific DOMExceptions and would rethrow anything else.
 *
 * Either way we install BEFORE the embed loader runs, so the embed's own host
 * sees a populated `navigator.modelContext` and no-ops by its own design. That
 * is deliberate: one host, one registry, one call log, in every browser.
 *
 * Consequence worth knowing: because the embed registers whenever a host exists
 * and does not gate on `?webmcp=1`, the tools come up with or without that
 * query flag. The flag stays supported (it also reveals the embed's own
 * copy-prompt pill), but dropping it still gets you a live tool surface.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  /** Cap the log so a long-running session cannot grow the DOM without bound. */
  var MAX_CALLS = 200;
  /** Cap serialized args/results — a composed layout is large. */
  var MAX_PAYLOAD_CHARS = 4000;

  var installed = false;
  var mode = 'uninstalled';
  var realHost = null;

  /** name -> { name, description, inputSchema, execute } as registered. */
  var registry = new Map();
  var calls = [];
  var listeners = [];
  var nextCallId = 1;
  /**
   * Set while a call is going through `window.webmcp.callTool`, so the log can
   * distinguish a JS-eval operator driving the page from the browser's own
   * agent invoking `execute` directly through the real host.
   */
  var inClientCall = false;

  function emit(type) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](type);
      } catch (err) {
        console.error('[playground] inspector listener failed:', err);
      }
    }
  }

  /** JSON, but never throwing and never unbounded. */
  function preview(value) {
    if (value === undefined) return undefined;
    var text;
    try {
      text = JSON.stringify(value);
    } catch (err) {
      text = String(value);
    }
    if (typeof text !== 'string') text = String(text);
    if (text.length <= MAX_PAYLOAD_CHARS) return text;
    return text.slice(0, MAX_PAYLOAD_CHARS) + '… [' + text.length + ' chars total]';
  }

  function startCall(name, params) {
    var entry = {
      id: nextCallId++,
      name: name,
      args: preview(params),
      source: inClientCall ? 'client' : 'agent',
      startedAt: Date.now(),
      status: 'running',
      durationMs: null,
      result: undefined,
      error: undefined
    };
    calls.push(entry);
    if (calls.length > MAX_CALLS) calls.splice(0, calls.length - MAX_CALLS);
    emit('call:start');
    return entry;
  }

  function settle(entry, status, payload) {
    entry.status = status;
    entry.durationMs = Date.now() - entry.startedAt;
    if (status === 'ok') entry.result = preview(payload);
    else entry.error = payload instanceof Error ? payload.message : String(payload);
    emit('call:end');
  }

  /**
   * An optional gate consulted before a tool runs: given a tool name it returns
   * a promise to await first, or null to run immediately. Used to hold an
   * agent-backed call until the page is actually able to serve it — see the
   * readiness gate in space-boot.js.
   */
  var precondition = null;

  /**
   * Optional rewriter for tool descriptions, applied as a tool passes through
   * to the host. This is the ONLY delivery channel with a hard guarantee: an
   * agent must read a tool's name, description and schema to call it at all,
   * whereas `window.webmcp.instructions` is not part of the registry contract
   * and /llms.txt is fetched only if the agent chooses to. Guidance an agent
   * genuinely cannot afford to miss belongs here; everything else belongs in
   * the guide.
   */
  var decorator = null;

  /**
   * Wrap a tool's `execute` so every invocation lands in the log — whichever
   * side calls it. Synchronous throws are captured too: the embed's param
   * guards throw eagerly before any await.
   */
  function instrument(name, execute) {
    return function (params) {
      var entry = startCall(name, params);

      // With a gate in play the call must become async, so the synchronous
      // throw path below no longer applies — errors surface as rejections
      // instead, which every caller already awaits. Without a gate the
      // original synchronous semantics are preserved exactly.
      var gate = precondition === null ? null : precondition(name);
      if (gate !== null && gate !== undefined) {
        return gate.then(function () {
          return execute(params);
        }).then(
          function (value) { settle(entry, 'ok', value); return value; },
          function (err) { settle(entry, 'error', err); throw err; }
        );
      }

      var pending;
      try {
        pending = execute(params);
      } catch (err) {
        settle(entry, 'error', err);
        throw err;
      }
      return Promise.resolve(pending).then(
        function (value) {
          settle(entry, 'ok', value);
          return value;
        },
        function (err) {
          settle(entry, 'error', err);
          throw err;
        }
      );
    };
  }

  function invalidState(message) {
    return new DOMException(message, 'InvalidStateError');
  }

  /**
   * The host we put on `navigator.modelContext`. In wrap mode it delegates to
   * the real host; in polyfill mode the local registry IS the host.
   */
  var host = {
    registerTool: function (tool, options) {
      if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) {
        throw new TypeError('registerTool: tool.name must be a non-empty string');
      }
      if (typeof tool.execute !== 'function') {
        throw new TypeError('registerTool: tool.execute must be a function');
      }

      var described = typeof tool.description === 'string' ? tool.description : '';
      if (decorator !== null) described = decorator(tool.name, described);

      var wrapped = {
        name: tool.name,
        description: described,
        inputSchema: tool.inputSchema === undefined ? {} : tool.inputSchema,
        execute: instrument(tool.name, tool.execute),
        // The uninstrumented original, so readiness checks can consult a read
        // tool without flooding the call log with their own polling.
        raw: tool.execute
      };

      if (realHost === null && registry.has(tool.name)) {
        // Polyfill mode mirrors the embed host exactly: it clears orphans
        // before registering and treats this error as "already exposed".
        throw invalidState('Duplicate tool name: ' + tool.name);
      }

      // Record before forwarding: if the real host rejects a duplicate, the
      // inspector should still show one live entry for that name rather than
      // nothing, since the embed swallows that error and keeps the tool.
      registry.set(tool.name, wrapped);
      emit('tools');

      if (realHost !== null) {
        realHost.registerTool(wrapped, options);
      }
    },

    unregisterTool: function (name) {
      var known = registry.has(name);
      registry.delete(name);
      if (known) emit('tools');

      if (realHost !== null) {
        if (typeof realHost.unregisterTool === 'function') realHost.unregisterTool(name);
        return;
      }
      if (!known) throw invalidState('Tool not registered: ' + name);
    }
  };

  /** The JS-eval client surface. The same shape the embed host serves. */
  var client = {
    isWebMCPAvailable: true,
    // Lazy: the composed instructions include the AMS guide, and reading them
    // on access rather than at install keeps this independent of script order.
    get instructions() {
      if (!window.PlaygroundOperatorPrompt) {
        return 'Operator contract unavailable — assets/operator-prompt.js did not load.';
      }
      return window.PlaygroundOperatorPrompt.text;
    },
    listTools: function () {
      var out = [];
      registry.forEach(function (tool) {
        out.push({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema });
      });
      return out;
    },
    callTool: function (name, args) {
      var tool = registry.get(name);
      if (!tool) {
        var available = [];
        registry.forEach(function (t) { available.push(t.name); });
        return Promise.reject(
          new Error('Unknown WebMCP tool: ' + name + '. Available: ' + available.join(', '))
        );
      }
      // `execute` is already instrumented; the flag only tags provenance, and
      // is cleared synchronously because execute returns a promise immediately.
      inClientCall = true;
      try {
        return Promise.resolve(tool.execute(args === undefined ? {} : args));
      } finally {
        inClientCall = false;
      }
    }
  };

  /** Define an own property, tolerating a prototype accessor underneath. */
  function define(target, key, value) {
    try {
      Object.defineProperty(target, key, { configurable: true, writable: true, value: value });
      return target[key] === value;
    } catch (err) {
      try {
        target[key] = value;
        return target[key] === value;
      } catch (err2) {
        return false;
      }
    }
  }

  /**
   * Install the host. Idempotent. Returns the resulting mode:
   *   'native'  — a real host was present and is now wrapped + instrumented
   *   'polyfill'— no host was present; this page provides one
   *   'blocked' — a host is present but `navigator.modelContext` refused to be
   *               shadowed, so calls cannot be instrumented. Reported honestly
   *               rather than showing an empty inspector as if nothing happened.
   */
  function install() {
    if (installed) return mode;
    installed = true;

    var existing = navigator.modelContext;
    var hasReal = !!existing && typeof existing.registerTool === 'function';
    realHost = hasReal ? existing : null;

    if (!define(navigator, 'modelContext', host)) {
      realHost = null;
      mode = hasReal ? 'blocked' : 'unsupported';
      console.warn('[playground] could not install WebMCP host on navigator.modelContext');
      emit('mode');
      return mode;
    }

    // Never clobber a richer client the browser or an extension already put
    // here — the same non-override principle the embed host follows.
    if (!window.webmcp) define(window, 'webmcp', client);

    mode = hasReal ? 'native' : 'polyfill';
    console.info(
      '[playground] WebMCP host installed (' + mode + '). ' +
        'Operator contract at window.webmcp.instructions; tools via window.webmcp.listTools().'
    );
    emit('mode');
    return mode;
  }

  window.PlaygroundWebMCP = {
    install: install,
    /**
     * Install a gate consulted before every tool call. `fn(name)` returns a
     * promise to await first, or null/undefined to proceed immediately.
     */
    setPrecondition: function (fn) { precondition = typeof fn === 'function' ? fn : null; },
    /**
     * Install a description rewriter. Must be set BEFORE the tools register,
     * i.e. before the embed loader is injected.
     */
    setDescriptionDecorator: function (fn) { decorator = typeof fn === 'function' ? fn : null; },
    /**
     * Call a tool WITHOUT logging it or applying the gate. For internal
     * readiness checks that would otherwise bury the demo's real calls.
     */
    peek: function (name, args) {
      var tool = registry.get(name);
      if (!tool) return Promise.reject(new Error('peek: unknown tool ' + name));
      return Promise.resolve(tool.raw(args === undefined ? {} : args));
    },
    mode: function () { return mode; },
    /** Registered tools, without the instrumented executes. */
    tools: function () { return client.listTools(); },
    calls: function () { return calls.slice(); },
    /** Register a tool this page owns (the launcher's own surface). */
    registerTool: function (tool) { host.registerTool(tool); },
    /**
     * Report which instruction channels are actually reachable, and how.
     *
     * "How do we know an agent gets the right instructions?" deserves an answer
     * anyone can reproduce in one paste rather than a claim in a README. Run
     * `PlaygroundWebMCP.selfCheck()` in the console of any brand page.
     *
     * The distinction it draws is the important part: a tool's name,
     * description and schema are GUARANTEED — an agent must read them to call
     * anything. Everything else is opt-in, and a native agent reading only the
     * registry will never see `window.webmcp.instructions` at all.
     */
    selfCheck: function () {
      var tools = client.listTools();
      var decorated = [];
      for (var i = 0; i < tools.length; i++) {
        if (tools[i].description.indexOf('OPERATING NOTES:') !== -1) decorated.push(tools[i].name);
      }
      var guideAt = -1;
      for (var j = 0; j < tools.length; j++) {
        if (tools[j].name === 'how_to_use_this_site') { guideAt = j; break; }
      }
      return {
        host_mode: mode,
        tools_registered: tools.length,
        guaranteed: {
          what: 'tool name + description + inputSchema — an agent must read these to call anything',
          tools_carrying_operating_notes: decorated,
          guide_tool_registered: guideAt >= 0,
          guide_tool_position: guideAt,
          guide_tool_is_first: guideAt === 0
        },
        opt_in: {
          'window.webmcp.instructions': {
            present: typeof client.instructions === 'string' && client.instructions.length > 0,
            length: typeof client.instructions === 'string' ? client.instructions.length : 0,
            caveat: 'NOT part of the registry contract — a native WebMCP agent never reads this. ' +
              'Only a JavaScript-capable agent told to look here will see it.'
          },
          'how_to_use_this_site': {
            discoverable: guideAt >= 0,
            caveat: 'On the registry, so every agent SEES it. Calling it is still the agent\'s choice.'
          },
          '/llms.txt': {
            caveat: 'Fetched only if the agent chooses to read the site before driving it.'
          }
        }
      };
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };
})();
