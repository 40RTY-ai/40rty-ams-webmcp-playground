/**
 * The four conversation intents the home screen offers, plus the free-text
 * option.
 *
 * These are written the way a shopper actually talks — an occasion, a place, a
 * season, a person — because that is the whole argument. A keyword ("heels")
 * gets you a filtered grid, which any store can do. A situation ("a beach
 * wedding in Florida, and I'm wearing red") gets you a store composed for it,
 * which is the thing no page could have been authored for in advance.
 *
 * Each one is sent verbatim to the storefront's AI as the opening prompt.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  var INTENTS = [
    {
      id: 'florida-wedding',
      tag: 'Destination wedding',
      // Two occasions, one outfit, a constraint on colour and one on terrain —
      // the beach rules out a stiletto, and the AI has to know that.
      hint: 'Two looks, one weekend, and sand',
      text: 'My friend is getting married in Florida next month, I need a set of beach shoes and high heels. I wear a red dress.'
    },
    {
      id: 'boston-conference',
      tag: 'Winter work trip',
      hint: 'Cold city, professional, needs to pack light',
      text: 'I have a conference in Boston in the winter, I need boots and a clutch.'
    },
    {
      id: 'gift-for-sister',
      tag: 'Gifting',
      hint: 'Shopping for someone else, with taste already known',
      text: 'Looking for a gift for my sister! She loves Steve Madden bags.'
    },
    {
      id: 'ibiza-weekend',
      tag: 'Nights out',
      hint: 'A mood rather than a product',
      text: 'I need something sexy for a weekend with friends in Ibiza.'
    }
  ];

  /**
   * Trim to a whole word within `max` characters. A hard slice would cut
   * mid-word and hand the stylist a fragment; losing the tail of a sentence is
   * better than sending "…and comfortable enough to walk a l".
   */
  function truncateToWord(text, max) {
    var cut = text.slice(0, max);
    var lastSpace = cut.lastIndexOf(' ');
    // Only back off to the word boundary when it does not gut the intent.
    if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
    return cut.replace(/[\s,;:—-]+$/, '');
  }

  /** Resolve an intent by id. Returns null when unknown. */
  function byId(id) {
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].id === String(id)) return INTENTS[i];
    }
    return null;
  }

  /**
   * The storefront URL for an OPENING prompt.
   *
   * `?intent=` is an opening mechanism and nothing else. AMS submits it only on
   * a genuinely new session, so it cannot inject itself into a conversation
   * already in flight. Two consequences, both verified against the live
   * storefront:
   *
   *   - A FOLLOW-UP cannot ride the URL. Navigating to `?intent=<follow-up>`
   *     inside a live session restores the conversation and ignores the intent
   *     entirely — silently. Follow-ups go through `send_message`.
   *   - A SECOND opening needs a fresh session. Session state is per-tab, so
   *     the same tab returning to the storefront restores the old conversation
   *     and drops the new intent. Every intent therefore opens in its OWN TAB,
   *     which also leaves this page up beside the store.
   *
   * `webmcp=1` rides along so the tool surface comes up even in a browser with
   * no native WebMCP host — without it, that page registers nothing and the
   * demo silently loses its point.
   */
  function storefrontUrl(intentText) {
    var config = window.PLAYGROUND_CONFIG;
    var base = config && typeof config.storefrontUrl === 'string' ? config.storefrontUrl : '';
    if (base.length === 0) {
      console.error('[playground] PLAYGROUND_CONFIG.storefrontUrl is not set — see assets/config.js');
      return '';
    }
    var url = base + (base.indexOf('?') === -1 ? '?' : '&') + 'webmcp=1';
    var text = typeof intentText === 'string' ? intentText.trim() : '';
    if (text.length === 0) return url;

    var max = config && typeof config.intentMaxChars === 'number' ? config.intentMaxChars : 200;
    if (text.length > max) text = truncateToWord(text, max);
    var param = config && typeof config.intentParam === 'string' ? config.intentParam : 'intent';
    return url + '&' + param + '=' + encodeURIComponent(text);
  }

  /** The ceiling the free-text box should enforce as you type. */
  function maxChars() {
    var config = window.PLAYGROUND_CONFIG;
    return config && typeof config.intentMaxChars === 'number' ? config.intentMaxChars : 200;
  }

  window.PlaygroundIntents = {
    all: INTENTS,
    maxChars: maxChars,
    byId: byId,
    storefrontUrl: storefrontUrl
  };
})();
