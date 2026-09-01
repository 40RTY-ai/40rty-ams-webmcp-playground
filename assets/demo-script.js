/**
 * "The Bachelorette Weekend Pivot" — a guided demo, as an executable plan.
 *
 * Written for two audiences at once. A presenter reads `say` and `watch`. An
 * agent reads `calls` and `verify` and drives the whole thing through tools.
 *
 * WHY EACH BEAT CARRIES A `verify`
 *
 * The demo spans a navigation to another origin, so nothing here can hold the
 * agent's place for it. It does not need to: the storefront reports its own
 * state, and every beat can be confirmed from it — `get_messages` says which
 * beats have been spoken, `get_visitor_context` says which constraints the
 * brand actually registered, `get_cart` says what was really bought. An agent
 * that loses its place re-reads those three and knows exactly where it is.
 * That is the flow state, and it lives in the live surface rather than in a
 * counter this page would have to keep honest.
 *
 * Every call below was run against the live storefront before it was written
 * down, and the timings are what actually happened.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  /**
   * The beach line, and why it is worded exactly like this.
   *
   * Three phrasings were measured. The terse version composed a look card with
   * only three slots and no jewellery. "Show it as one complete look I can buy"
   * filled four slots but let the palette drift — it chose a CLEAR shoe for a
   * pink look. Naming the slots produced all four, held the palette, and was
   * ten seconds faster than either.
   *
   * The distinction that matters: be explicit about THE LOOK CARD AND ITS
   * SLOTS, not verbose about the scenario. An earlier attempt that elaborated
   * on the scenario instead ("the wedding moved to a beach party, rework the
   * whole look for sand and heat") returned good prose and NO look card at all.
   * More words about the situation is not the same as a clearer instruction.
   */
  var BEACH_LINE =
    "Change of plans — it's a beach party now. Commit to one featured look: dress, shoes, bag and jewellery.";

  var DEMO = {
    id: 'wedding-pink-beach',
    title: 'The Wedding That Kept Changing',
    premise:
      'A classic dinner-wedding look, then the palette changes, then the venue does. ' +
      'Two pivots that rebuild the whole outfit — and a size that survives both.',

    /**
     * Naming the categories is what makes the first turn big: "a dress and
     * heels" composes a small card, while asking for the whole look with its
     * pieces named composes a four-item hero card over eighteen products.
     * Comfortably inside the 1000-character URL ceiling.
     */
    opening:
      'I have a classic dinner wedding next month. I need the whole look: a dress, high heels, a clutch and jewellery.',

    beats: [
      {
        n: 1,
        say: 'I have a classic dinner wedding next month. I need the whole look: a dress, high heels, a clutch and jewellery.',
        calls: ['send_message({ message: "<the line above>" })'],
        watch: 'A hero look card over a grid: dress, stiletto, clutch, earrings, priced as a set.',
        proves: 'One sentence becomes a composed store across four categories.',
        verify: 'get_layout shows a lookCard; get_products returns ~18 items.',
        measured: '20-25s from the store\'s default page. "The Midnight Dinner Edit" — Phia Dress Midnight $159, Gorgina Champagne $249.95, Leena Bag Black $88, stud earrings $9.99.'
      },
      {
        n: 2,
        say: "I'm a size 7 — only show me what I can actually buy.",
        calls: [
          'set_visitor_context({ context: { Size: "7" } })',
          'send_message({ message: "I\'m a size 7 — only show me what I can actually buy." })'
        ],
        watch: 'A size chip pins to the header. The look holds; the stylist reports what it checked.',
        proves: 'A standing constraint, and stock grounded rather than assumed.',
        verify: 'get_visitor_context reports it under the brand\'s own key (beauty_size).',
        measured: '6.7s. Kept the edit and named the inventory it had checked.'
      },
      {
        n: 3,
        say: 'Actually, make the whole thing pink for the dinner.',
        calls: ['send_message({ message: "Actually, make the whole thing pink for the dinner." })'],
        watch: 'The palette pivot. Dress, shoes and bag all change; the occasion does not.',
        proves: 'It rebuilds a look around one aesthetic constraint rather than filtering by colour.',
        verify: 'The look card is renamed and every garment differs from beat 2.',
        measured: '14.5s. "The Pink Dinner Edit" — Tiered Tulle Gown Dawn Pink $69.99, Larina Pink Satin $119.95, Marisol Bag Pink $78.'
      },
      {
        n: 4,
        say: BEACH_LINE,
        calls: ['send_message({ message: "<the line above, verbatim>" })'],
        watch: 'The occasion pivot, and the best moment in the demo. Stilettos and tulle go; the pink stays.',
        proves: 'Generative composition. No merchant authored a pink beach-wedding page.',
        verify: 'A lookCard exists, is renamed again, holds all four slots, and the palette is still pink.',
        measured: '17.7s. "The Pink Beach Wedding Edit" — Lara Dress Tropical Breeze $119, Kola Pink Raffia $29.99, Marisol Bag Pink $78, link chain necklace $25.'
      },
      {
        n: 5,
        say: 'Add the shoes in my size.',
        calls: [
          'get_layout()                          — take the featured ids from the look card',
          'get_products({ productIds: [ids] })   — option axes, variants, catalogue prices',
          'add_to_cart({ productId, selections: { Size: "7", ... } })',
          'begin_checkout()                      — only once they have said they want to buy'
        ],
        watch: 'The cart drawer opens with the named line and a subtotal, checkout ready.',
        proves: 'The composed experience ends in a grounded transaction, in the size she asked for.',
        verify: 'add_to_cart returns the added line plus subtotal and total; get_cart agrees immediately.',
        measured: 'Returns in ~1.6s already settled.'
      }
    ],

    caveats: [
      'Every beat is a send_message on the page already open. The store starts on its own ' +
        'default layout, so the first look is the agent\'s work too — which is the point.',
      'Do not try to steer this store by rewriting its URL. An intent on the URL is ' +
        'submitted only on a NEW session, so inside a live conversation it is ignored — ' +
        'silently, with the previous look still on screen.',
      'The storefront registers its tools before its session exists, so a send_message ' +
        'fired the instant tools appear can come back TURN_FAILED / no_response. The demo ' +
        'server holds agent-backed calls until the session is up; if you are driving a ' +
        'storefront without that gate, read get_status first.',
      'Starting over needs a fresh tab, or clear_session. Session state is per-tab.',
      'Ask for the LOOK CARD, not for more scenario. Naming the slots ("commit to one ' +
        'featured look: dress, shoes, bag and jewellery") reliably produces a complete, ' +
        'committed look. Elaborating on the situation instead returned good prose and no ' +
        'look card at all — the pieces scattered across sections with nothing to buy.',
      'If a pivot lands as sections with no look card, do not buy from it. Ask the store to ' +
        'commit first: "Commit those pieces as one featured look I can buy." Then read the ' +
        'card and continue.',
      'The beach beat flaked once in four early runs: ~5s, empty prose, nothing recomposed. ' +
        'Distinct from the 15s cap. Say so and send it again rather than narrating a change ' +
        'that did not occur.',
      'NEVER hold a variant id. get_products returns none by design — they are unstable ' +
        'across the optimistic-write window. Cart verbs address a product plus ' +
        '{axis: value} selections and bind late against live state.',
      'add_to_cart WITHOUT selections lets the page choose a variant, which may not be ' +
        'the size the visitor asked for. Read the detailed product first.',
      'A featured item can still be sold out in her size — seen in one run of five. Check ' +
        'the variant before promising anything, and if the featured shoe cannot be bought ' +
        'in her size, ask the store to swap it rather than buying something she never saw.',
      'get_visitor_context reads empty until the brand has absorbed the turn, and answers ' +
        'in the brand\'s own key names, not the ones you sent.'
    ]
  };

  /**
   * The demo as a GOAL an agent can be handed.
   *
   * Browser agents run under a user-initiated rule: nothing starts until a
   * person pastes something in. So the demo is delivered as a prompt the
   * visitor copies, not as an action this page takes. The beats are spelled out
   * inline rather than left in a tool, because the agent crosses a navigation
   * partway through and must not depend on a tool that only exists on the page
   * it started from.
   *
   * Written as instructions to the agent, in the order it will need them.
   */
  function goal() {
    return [
      'Run the "Wedding That Kept Changing" demo on this storefront, end to end.',
      '',
      'The page is showing the store\'s own default layout. Everything the visitor sees from',
      'here on is something you asked it to build — including the first look. Five beats, all',
      'of them a send_message on this page. Nothing to navigate.',
      '',
      'BEAT 1 — the first look',
      '  send_message({ "message": "I have a classic dinner wedding next month. I need the',
      '    whole look: a dress, high heels, a clutch and jewellery." })',
      '  Naming the pieces is what makes it compose a full look rather than a couple of',
      '  products. Expect 20-25 seconds.',
      '',
      'Then run the rest IN ORDER, one at a time, awaiting each before starting the next.',
      '',
      'HOW TO WAIT PROPERLY — this is the thing that will otherwise ruin the demo.',
      'send_message stops waiting after 15 seconds, and these composing turns often take',
      '25-30. When that happens it returns at exactly 15.00s with EMPTY text and',
      'status "running". The turn has NOT failed; it is still composing.',
      '',
      'On status "running": poll get_status every 2-3 seconds until isRunning is false,',
      'then read latestResponse — that is the reply. Relay that. Do NOT send the message',
      'again: the turn already running is the one doing the work, and a second one would',
      'queue a second turn against the same layout. Never report "nothing happened" just',
      'because the first return was empty — check before you say it.',
      '',
      'TWO RULES THAT MATTER MORE THAN THE BEATS:',
      '',
      'PRICES AND STOCK COME FROM TOOLS, NEVER FROM PROSE. Copy can lag the catalogue.',
      'Before you repeat any price or say anything is buyable, read it with get_products. If',
      'the prose and the tool disagree, trust the tool and say so plainly — that',
      'contradiction is worth showing rather than smoothing over.',
      '',
      'AVAILABLE IS NOT THE SAME AS AVAILABLE IN HER SIZE. A product can report available',
      'while the size 7 variant is sold out. Check the variant:',
      'get_products({"productIds":[id]}) and look for one whose selections include Size 7',
      'AND whose available is true. Do this before featuring, quoting or buying anything.',
      '',
      'BEAT 2 — her size',
      '  set_visitor_context({ "context": { "Size": "7" } })',
      '  send_message({ "message": "I\'m a size 7 — only show me what I can actually buy." })',
      '  Then get_visitor_context. The brand answers in its own key names, so expect',
      '  something like beauty_size rather than the "Size" you sent.',
      '',
      'BEAT 3 — the palette pivot',
      '  send_message({ "message": "Actually, make the whole thing pink for the dinner." })',
      '  The dress, the shoes and the bag should all change while the occasion stays a',
      '  dinner. Say which pieces changed — that is the point of the beat.',
      '',
      'BEAT 4 — the occasion pivot, and the best moment in the demo',
      '  send_message({ "message": "Change of plans — it\'s a beach party now. Commit to one',
      '    featured look: dress, shoes, bag and jewellery." })',
      '  Send it exactly as written. Naming the slots is what makes the store commit to one',
      '  buyable look; asking more vaguely has scattered the pieces across sections with no',
      '  look card at all, and elaborating on the scenario made it worse rather than clearer.',
      '  The pink should SURVIVE while the stilettos and the tulle do not — call that out.',
      '',
      '  THEN CHECK there is a look card: get_layout() and look for a lookCard with products.',
      '  If the pivot produced only sections and no card, do NOT buy from the sections. Ask',
      '  the store to commit first:',
      '    send_message({ "message": "Commit those pieces as one featured look I can buy." })',
      '  Wait for it, re-read get_layout, and continue from the card.',
      '  If this returns empty at 15s, that is the timeout above, not a failure — wait it',
      '  out with get_status. Only if isRunning goes false with nothing committed should you',
      '  say the turn came back empty, and then send it once more.',
      '',
      'BEAT 5 — buy the shoes that are actually on screen',
      '  get_layout() FIRST, and take the product ids from the look card — those are the',
      '    items the stylist actually featured. Do not start from a broad get_products():',
      '    the survey returns the grids and rails too, so the outfit is ambiguous.',
      '  get_products({ "productIds": [<the look card ids>] }) — one call, all of them —',
      '    for their option axes, variants and catalogue prices. Check for an available Size 7.',
      '',
      '  IF THE FEATURED SHOE HAS NO AVAILABLE SIZE 7: do not quietly buy a different one.',
      '    Say which shoe it is and that it is sold out in her size, then ask the store to',
      '    fix the look: send_message({ "message": "The <name> is sold out in size 7 —',
      '    swap it for something I can actually buy." }). Let it recompose, then continue.',
      '    Buying a substitute the page never showed is the one failure that breaks trust.',
      '',
      '  add_to_cart({ "productId": "<id>", "selections": { "Size": "7", ... } })',
      '    Pass the EXACT option values that product reports. Never a variant id.',
      '  It settles before it returns and reports the line, the quantity and the new total.',
      '    Quote those: "Added <title>, size 7, $<unitPrice> — cart total $<total>."',
      '  STOP THERE. Do not call begin_checkout — that would take the visitor off the page.',
      '',
      'AFTER EACH BEAT: relay the storefront\'s own reply verbatim, then add one line of your',
      'own saying what changed on screen. Do not summarise the reply and do not write over it.',
      '',
      'WHEN YOU QUOTE AN OUTFIT TOTAL: add up the prices you read from get_products for the',
      'items actually featured, and say that is where the number came from.'
    ].join('\n');
  }

  /**
   * The paste-ready prompt.
   *
   * Deliberately COMPACT — the operating rules and the full guide are already
   * served by this page, at window.webmcp.instructions and through the
   * how_to_use_this_site tool, so inlining them would make a 15KB paste out of
   * something the agent can fetch in one call. What cannot be fetched is the
   * demo itself once the agent has navigated away from this page, so the beats
   * stay inline.
   */
  function prompt() {
    return [
      'You are operating a WebMCP page — a storefront that composes itself around what you ask',
      'for. Its registered tools are your only interface to it: never read or manipulate the',
      'DOM, never scrape the page, and verify every action through a tool rather than by looking.',
      '',
      'First, silently: call window.webmcp.listTools(), then call how_to_use_this_site if it is',
      'there. It explains what this kind of store is, what else you can ask it for beyond a',
      'filter, and — the part worth reading — what to do when an answer comes back in the wrong',
      'shape: no committed look, a missing piece, an item sold out in her size, an empty reply',
      'that is really still composing. Do not report the tool list back to me and do not ask',
      'permission. Just start.',
      '',
      'The habit that matters throughout: when the store gives you something you cannot use,',
      'ASK IT for what is missing rather than working around it. If it lays out sections but',
      'never commits a look, ask it to commit one. If the look is missing a bag, ask for the',
      'bag. It will do it, and the asking is itself the demo.',
      '',
      goal()
    ].join('\n');
  }

  /** Everything: operating contract + the full AMS guide + the demo goal. */
  function promptFull() {
    if (!window.PlaygroundOperatorPrompt) return prompt();
    return window.PlaygroundOperatorPrompt.build(goal());
  }

  function followUps() {
    return DEMO.beats.filter(function (b) { return b.n > 1; }).map(function (b) { return b.say; });
  }

  /**
   * `options.navigational` — whether this page reaches the storefront by
   * navigating. On the proxied demo it does not: the storefront IS this page, so
   * a start_demo that navigates would be a tool advertising a hop that no longer
   * exists. Beat 1 is simply the first send_message.
   */
  function registerTool(host, intents, options) {
    var navigational = !(options && options.navigational === false);

    if (navigational) host.registerTool({
      name: 'start_demo',
      description:
        'Open the storefront and begin the guided demo ("The Bachelorette Weekend Pivot") by ' +
        'delivering its opening beat. Read get_demo_script first — this runs beat 1 only. It ' +
        'NAVIGATES to the storefront, which registers its own sixteen tools and composes the ' +
        'opening look automatically (15-20s). Every later beat is a send_message on that page; ' +
        'an intent on the URL is ignored once a session is live.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: function () {
        if (!intents) return Promise.reject(new Error('start_demo: intents unavailable'));
        var url = intents.storefrontUrl(DEMO.opening);
        setTimeout(function () { window.location.assign(url); }, 0);
        return Promise.resolve({
          status: 'navigating',
          beat: 1,
          said: DEMO.opening,
          url: url,
          next: 'Wait for the new document and the opening to compose, re-run discovery, read ' +
            'the reply with get_messages, then run beats 2-6 from get_demo_script with ' +
            'send_message — one at a time, awaiting each.',
          remaining_beats: DEMO.beats.filter(function (b) { return b.n > 1; })
            .map(function (b) { return { n: b.n, say: b.say, calls: b.calls, verify: b.verify }; })
        });
      }
    });

    host.registerTool({
      name: 'get_demo_script',
      description:
        'A guided six-beat demo of this storefront ("The Bachelorette Weekend Pivot"), as an ' +
        'executable plan. Each beat carries the sentence to say, the exact tool calls that ' +
        'deliver it, how to VERIFY it landed, and how long it took when measured. Also returns ' +
        'the rules that make the demo fail quietly if broken. Read this before driving the demo. ' +
        'The beats run in order, one at a time, awaiting each.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: function () {
        return Promise.resolve({
          demo: DEMO.title,
          premise: DEMO.premise,
          how_to_start: navigational
            ? 'start_demo(), or start_shopping({ intent: "' + DEMO.opening + '" })'
            : 'You are already on the storefront. Beat 1 is simply send_message with the ' +
              'opening line — the page is on the store\'s default layout and every beat, ' +
              'including the first, is yours to send.',
          beats: DEMO.beats,
          where_am_i:
            'This page cannot follow you across the navigation, and does not need to — the ' +
            'storefront reports its own state. get_messages tells you which beats have been ' +
            'spoken, get_visitor_context which constraints the brand registered, and get_cart ' +
            'what was actually bought. Re-read those three to find your place at any point.',
          caveats: DEMO.caveats
        });
      }
    });
  }

  window.PlaygroundDemo = {
    data: DEMO,
    goal: goal,
    prompt: prompt,
    promptFull: promptFull,
    followUps: followUps,
    registerTool: registerTool
  };
})();
