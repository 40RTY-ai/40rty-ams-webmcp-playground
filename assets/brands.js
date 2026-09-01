/**
 * The four live merchant spaces, and everything the playground needs to know
 * about each one.
 *
 * CLASSIC SCRIPT, not a module. Every script on these pages is classic and
 * un-deferred so execution order is exactly source order — which matters,
 * because the instrumented WebMCP host MUST be installed before the AMS embed
 * loader boots and calls `registerTool`. `type="module"` implies `defer`, which
 * would silently break that ordering guarantee.
 *
 * `path` is the public URL segment; `slug` is the AMS space slug the embed
 * addresses (`/s/:slug`). This is only the instrumented view — the home screen
 * hands off to the deployed storefront instead, and does not read this.
 */
(function () {
  'use strict';

  /** AMS API base, from config.js. Also serves the embed bundle. */
  function configuredApiUrl() {
    var config = window.PLAYGROUND_CONFIG;
    if (!config || typeof config.apiBaseUrl !== 'string' || config.apiBaseUrl.length === 0) {
      console.error('[playground] PLAYGROUND_CONFIG.apiBaseUrl is not set — see assets/config.js');
      return '';
    }
    return config.apiBaseUrl;
  }

  var BRANDS = [
    {
      path: 'instrumented',
      slug: 'stevemadden',
      name: 'Steve Madden',
      category: 'Instrumented view',
      site: 'stevemadden.com',
      blurb: 'The same space, embedded here so the inspector sits on top of it.',
      accent: '#111111',
      accentText: '#ffffff',
      prompts: [
        'I need wide-calf boots under $140 that I can wear all day.',
        'Actually, only the ones with a wide toe box — and show me how they compare.',
        "I'm going to a winter wedding. Build me a look, shoes first."
      ]
    }
  ];

  /**
   * API base URL. `?api=` override exists so a cold-machine test or a staging
   * check can retarget without a redeploy — the submitted URL never needs it.
   * Trailing slash trimmed because the embed concatenates paths onto this.
   */
  function apiUrl() {
    var override = new URLSearchParams(window.location.search).get('api');
    var value = override !== null && override.length > 0 ? override : configuredApiUrl();
    return value.charAt(value.length - 1) === '/' ? value.slice(0, -1) : value;
  }

  /** Resolve a brand by its public path segment. Returns null when unknown. */
  function byPath(path) {
    var cleaned = String(path).replace(/^\/+|\/+$/g, '').toLowerCase();
    for (var i = 0; i < BRANDS.length; i++) {
      if (BRANDS[i].path === cleaned) return BRANDS[i];
    }
    return null;
  }

  /** The brand this document is for, derived from its own pathname. */
  function current() {
    return byPath(window.location.pathname);
  }

  window.PlaygroundBrands = {
    all: BRANDS,
    byPath: byPath,
    current: current,
    apiUrl: apiUrl,
    loaderUrl: function () { return apiUrl() + '/embed/fourty-loader.js'; }
  };
})();
