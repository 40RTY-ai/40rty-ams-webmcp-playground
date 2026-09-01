/**
 * What AMS is, and how an external agent should drive it.
 *
 * WHY THIS EXISTS
 *
 * The operator contract in operator-prompt.js is deliberately tool-agnostic: it
 * tells an agent how to behave as a well-formed WebMCP client, and it names no
 * tool, so it survives any per-space change to the surface. That is the right
 * shape for a contract — and it is not enough on its own. An agent that reads
 * only the contract knows the RULES but not the CAPABILITY: it will treat
 * `send_message` as a search box, type "boots", get a competent answer, and
 * never discover that it can ask for a presentation rather than a filter.
 *
 * So this file carries the part the contract cannot: what this kind of site is,
 * what its tools are actually for, how long they take, what the data looks like,
 * and how to phrase a request to a layout-composing AI. It reaches an agent
 * three ways, all of them on-protocol:
 *
 *   - `window.webmcp.instructions` — contract + this guide, served at runtime
 *   - the `how_to_use_this_site` tool — discoverable through listTools()
 *   - /llms.txt — generated from this file by scripts/gen-llms-txt.mjs
 *
 * Everything asserted here is drawn from the registered tool surface itself or
 * measured against the live deployment. Keep it that way: an agent-facing
 * document that drifts from the tools is worse than no document, because the
 * agent will trust it over what it can see.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
(function () {
  'use strict';

  var GUIDE = {
    what_this_is: [
      'This is an AMS space: a storefront that COMPOSES itself around what you ask for.',
      '',
      'Worth knowing why that matters to you specifically. WebMCP lets a page hand you real',
      'tools instead of buttons to guess at — but on an ordinary site those tools are a',
      'better remote control for a page that was authored months ago. Here the page is',
      'composed per request, so calling a tool does not navigate a store, it changes what',
      'the store IS. That is the difference to play to.',
      '',
      'There are no authored pages here. Nothing you see was designed in advance for the',
      'request you are about to make. The site has its own AI, and it builds a layout per',
      'request over a real merchant catalog — real products, real prices, real stock.',
      '',
      'The practical consequence, and the thing most agents miss: this is NOT a search',
      'box behind a tool call. Describing a keyword gets you a keyword result. Describing',
      "the shopper's actual situation — constraints, budget, occasion, timeline, who it is",
      'for, what went wrong with the last thing they bought — gets you a store built for',
      'that situation.'
    ].join('\n'),

    the_thing_that_matters: [
      'FOLLOW-UPS RECOMPOSE. The session accumulates context.',
      '',
      'They go through send_message, always. If you arrived by way of an intent on the URL,',
      "that was an OPENING only — a further intent on the URL is ignored inside a live",
      'session, and ignored silently, leaving the previous layout up as though nothing was',
      'asked. Never try to steer this store by rewriting its URL.',
      '',
      'A second message refines the first rather than starting over, so say what CHANGES,',
      'not everything again. "Only the ones with a wide toe box, and show me how they',
      'compare" is a complete second turn. The layout rearranges around it.',
      '',
      'If you take one behaviour from this guide: after the first answer, keep going in',
      'the same session. One prompt is a query. Three prompts is the product.'
    ].join('\n'),

    tools_by_job: {
      compose: {
        tools: ['send_message', 'show_collection'],
        note: [
          'AGENT-BACKED. These hand your request to the site\'s own AI and return its response',
          'text. They are the only tools that change what the storefront shows in a',
          'substantive way.',
          '',
          'THEY GIVE UP WAITING AT 15 SECONDS. A composing turn often takes longer than that.',
          'When it does, the call returns at exactly 15.00s with EMPTY text and',
          'status "running" — the turn has not failed, it is still going. Measured: a reply',
          'that came back empty at 15s was complete and 448 characters long by about 30s.',
          '',
          'So on status "running", finish the wait rather than reporting nothing: poll',
          'get_status every 2-3 seconds until isRunning is false, then read latestResponse —',
          'that is the committed reply. Do NOT send the message again; the turn you already',
          'started is the one doing the work, and a second would queue a second turn.',
          '',
          'Only status "error", or isRunning false with nothing committed, means the turn',
          'produced no answer.',
          '',
          'Relay the returned text VERBATIM. It is the site speaking, in its own voice, about',
          'its own catalog. Do not paraphrase it, summarise it, or write your own prose over',
          'it. You operate the tools; the site is the voice.'
        ].join('\n')
      },
      remember: {
        tools: ['get_visitor_context', 'set_visitor_context'],
        note: [
          'Standing preferences and constraints the visitor has STATED about themselves — a',
          'size, a fit, a colour, a budget. Read get_visitor_context BEFORE asking for something',
          'they may already have said; re-asking for a size they gave earlier is the fastest way',
          'to sound like a stranger.',
          '',
          'set_visitor_context states a preference; it does not store one. The brand decides what',
          'it recognises and answers in ITS OWN key names — state {"Size": "7"} to Steve Madden',
          'and it comes back as beauty_size. It also reads empty until the brand has absorbed the',
          'turn, so do not treat an immediate empty read as failure.',
          '',
          'Only for what the visitor actually said about themselves. A one-off request is a',
          'send_message, not a standing constraint.'
        ].join('\n')
      },
      read: {
        tools: ['get_products', 'get_layout', 'get_messages', 'get_status'],
        note: [
          'Instant and cheap. These are ground truth for anything you are about to say out',
          'loud — never describe a product, price, or availability you have not read from',
          'get_products.',
          '',
          'get_products has TWO shapes. Called bare, it surveys the canvas and returns a compact',
          'record per product — id, title, price, availability, image. Called with productIds it',
          'returns the FULL record for those: the description, the option axes, and every variant',
          'with its exact option values. Read the full record before you buy anything.',
          '',
          'get_layout gives the raw layout tree with products as bare ids — useful for structure,',
          'poor for talking to a person. It is also the ONLY way to tell what was actually',
          'FEATURED: a look card carries its own product list, while a bare get_products survey',
          'returns the grids and rails alongside it, so "the outfit" is otherwise ambiguous.',
          'When you need the chosen items — to price them, check their stock, or buy them —',
          'take the ids from the look card and ask for those exact ids.'
        ].join('\n')
      },
      act: {
        tools: ['open_product', 'send_signal'],
        note: [
          'Instant. These dispatch the same interactions a click would, so a tool call and a',
          'human click hit identical code paths. Prefer the typed tools; reach for send_signal',
          'only for a signal type they do not cover.'
        ].join('\n')
      },
      buy: {
        tools: ['add_to_cart', 'get_cart', 'update_cart_item', 'remove_from_cart', 'begin_checkout'],
        note: [
          'NEVER HOLD A VARIANT ID. get_products does not give you one, deliberately: variant and',
          'cart-line ids are unstable across the optimistic-write window, so an id held across a',
          'beat can aim a write at a line that has already been replaced. Every cart verb instead',
          'addresses a product plus {axis: value} selections and binds late, against live state —',
          'so a stale reference can only MISS and fail loudly, never quietly mutate the wrong line.',
          '',
          'Before adding, read the full product record (get_products with its productId) and pass',
          'the exact option values the visitor asked for: {"Size": "7"}. WITHOUT selections the',
          'page picks an available variant for you, which may not be the size they meant.',
          '',
          'add_to_cart settles before it returns, and reports what landed: the line it added,',
          'the cart quantity, and the new subtotal and total. Quote those rather than composing',
          'your own sentence about it. get_cart is still the way to read the whole cart, but you',
          'no longer need it merely to confirm an add worked.',
          '',
          'update_cart_item takes an ABSOLUTE quantity, not a delta. remove_from_cart without',
          'selections removes EVERY line of that product.',
          '',
          'begin_checkout takes the visitor off the page. Only when they have said they want to buy.'
        ].join('\n')
      },
      reset: {
        tools: ['clear_session'],
        note: [
          'Destroys the layout, the conversation, and the accumulated context. Almost never',
          'what you want — the accumulated context IS the value. Only call it if the person',
          'explicitly asks to start over.'
        ].join('\n')
      }
    },

    how_to_run_a_session: [
      '1. listTools() — discover the surface. Silently; do not report it.',
      '2. get_status — orient. Is there already a layout and a conversation in progress?',
      '3. send_message — state the intent, in the shopper\'s terms, with the constraints.',
      '4. Relay the returned text verbatim.',
      '5. get_products — real titles, prices and ids for whatever is now on the canvas.',
      '6. send_message again — refine. This is where the site earns its keep.',
      '7. To buy: get_products({productIds}) for the full record, add_to_cart with the exact',
      '   selections, then get_cart to confirm what landed, then begin_checkout.',
      '',
      'Do not skip step 5: everything downstream needs ids, and ids only come from a read.',
      'Do not skip the get_cart confirmation: an add is dispatched, not completed.'
    ].join('\n'),

    timing: [
      'send_message and show_collection typically take 5-20 SECONDS. That is the AI',
      'searching a real catalog and composing a layout, not latency to route around.',
      '',
      '- Await every call. One at a time.',
      '- Do NOT fire concurrent compose calls. Two prompts in flight means two turns',
      '  competing over one layout.',
      '- Do NOT retry a slow call. A retry does not arrive sooner; it queues a SECOND turn,',
      '  and the person gets two answers to one question.',
      '- The first compose call on a freshly loaded page is the slowest: the session has to',
      '  establish before the AI can be reached. Waiting is correct behaviour.',
      '',
      'Read tools and actions return in milliseconds.'
    ].join('\n'),

    data_shapes: [
      'Products are addressed by id, in the form:',
      '  gid://shopify/Product/1234567890',
      '',
      'Variants are NOT addressed by id — see the cart note above. They are addressed by',
      'their option values, exactly as the product reports them.',
      '',
      'get_products (bare) returns, per product:',
      '  { id, title, handle, price: { amount, currencyCode }, available, image }',
      '',
      'get_products({ productIds }) adds:',
      '  { description, vendor, productType,',
      '    options:  { "Size": ["5","6","7",…], "Color": ["PINK SATIN"] },',
      '    variants: [ { title, available, price, selections: { Size: "7", … } } ] }',
      '',
      'get_cart returns:',
      '  { status, empty, totalQuantity, subtotal, total, checkoutAvailable,',
      '    lines: [ { productId, title, quantity, unitPrice, totalPrice, selections } ] }',
      '',
      'Cart writes made through these tools are stamped origin "webmcp", so conversions',
      'driven by an agent are distinguishable from conversions driven by a click.',
      '',
      'get_status returns:',
      '  { sessionId, isRunning, hasLayout, error, responseText, latestResponse }',
      'responseText is live streaming prose and is non-empty only MID-turn. The committed',
      'reply is latestResponse. Since send_message already awaits and returns the answer,',
      'read get_status for STATE, not for completion.'
    ].join('\n'),

    writing_a_good_prompt: [
      'send_message takes natural language. Two kinds of thing work, and the second is the',
      'one agents routinely fail to use.',
      '',
      'INTENT — the situation, not the keyword:',
      '  "I need wide-calf boots under $140 that I can wear all day."',
      '  "Newborn, small nursery, breathing monitoring without a wearable."',
      '  "Quarter-acre yard, no gas, mower and trimmer on one battery."',
      '  "My partner wears vintage gold, nothing flashy."',
      '',
      'PRESENTATION — because the AI composes the LAYOUT, you can ask for a shape:',
      '  "Show me how they compare."',
      '  "Fewer options, with the trade-offs made explicit."',
      '  "Group these by price and tell me what I lose at each step down."',
      '  "Just the two you would actually recommend, and why."',
      '',
      'You can combine them in one sentence, and you should: constraint plus presentation',
      'is the request this site is built for.',
      '',
      'WHAT DOES NOT WORK:',
      '  - Bare keywords ("boots"). You get a generic result and learn nothing.',
      '  - Asking for pages, URLs, or navigation. There are no authored pages to fetch.',
      '  - Asking it to search the web. Its catalog is the merchant\'s, and that is the point.'
    ].join('\n'),

    asking_for_more: [
      'Things this store can do that agents routinely never try. Each of these is a plain',
      'sentence to send_message, not a tool.',
      '',
      'ASK FOR A SHAPE, NOT JUST A FILTER. Because the layout is composed, the presentation',
      'is yours to request:',
      '  "Show me how these compare."',
      '  "Fewer options, with the trade-offs made explicit."',
      '  "Just the two you would actually recommend, and why."',
      '  "Group these by price and tell me what I lose at each step down."',
      '',
      'ASK IT TO COMMIT A LOOK. A composed page can be a set of browsing sections OR one',
      'featured look with a total. If you need something buyable, ask for the look:',
      '  "Commit those pieces as one featured look I can buy."',
      'Naming the slots gets a complete one: "one featured look: dress, shoes, bag and',
      'jewellery". Measured — naming the slots filled four of them and held the palette,',
      'while asking vaguely filled three or let the colour drift.',
      '',
      'ASK FOR ONE SLOT TO CHANGE. You do not have to restate the outfit to alter part of it:',
      '  "Swap the heels for something flat, keep everything else."',
      '  "Same look, but a bag I could carry to work as well."',
      '',
      'CHANGE ONE CONSTRAINT AT A TIME AND IT CHANGES ONLY THAT. Ask for a different palette',
      'and the occasion holds; change the occasion and the palette survives. That is the',
      'store\'s strongest behaviour and it is worth naming out loud when it happens.',
      '',
      'STATE A STANDING CONSTRAINT ONCE. A size or a budget given through set_visitor_context',
      'or stated in conversation persists across every later recomposition. Do not repeat it',
      'in each message; do check it landed with get_visitor_context.',
      '',
      'BROWSE BY NAME when the visitor names a category rather than a situation:',
      'show_collection({ title: "…" }). And open_product to drill into one thing they asked',
      'about, rather than describing it at them.'
    ].join('\n'),

    when_it_does_not_look_right: [
      'The store is a live AI over a live catalogue, so an answer can arrive in the wrong',
      'SHAPE without anything having failed. Each of these has been observed; the response',
      'is always to ask the store for what is missing rather than to work around it.',
      '',
      'NO LOOK CARD, JUST SECTIONS. The pieces are scattered and there is nothing committed',
      'to buy. Do not cart from a section — ask it to commit:',
      '  "Commit those pieces as one featured look I can buy."',
      'Then re-read get_layout and work from the card.',
      '',
      'THE LOOK IS MISSING A SLOT. Three items when you wanted four, no bag, no jewellery.',
      'Name what is absent: "add a bag and jewellery to that look."',
      '',
      'A FEATURED ITEM IS SOLD OUT IN THEIR SIZE. Say which one, then ask for a replacement',
      'rather than quietly buying a different item:',
      '  "The <name> is sold out in size 7 — swap it for something I can actually buy."',
      'Never cart a substitute the page never showed. That is the one failure a shopper',
      'would discover at checkout, and it costs more trust than an honest "let me fix that".',
      '',
      'THE COPY AND THE CATALOGUE DISAGREE ON A PRICE. Trust the tool, and say both out loud:',
      '"the page says $29.99, the catalogue says $39.99." A quiet correction hides a real',
      'problem; naming it is useful to everyone.',
      '',
      'AN EMPTY REPLY WITH status "running". Not a failure — the 15-second wait elapsed and',
      'the turn is still composing. Poll get_status until isRunning is false, then read',
      'latestResponse. Do not resend.',
      '',
      'AN EMPTY REPLY THAT CAME BACK FAST, with isRunning false and nothing committed. That',
      'one really did produce nothing. Say so plainly and send the message once more. Do not',
      'narrate a change that did not happen — the layout is unchanged and the visitor can',
      'see that.',
      '',
      'THE LAYOUT CHANGED BUT YOU HAVE NO PROSE. Read get_messages: the reply may have',
      'committed after your call returned. Relay it rather than writing your own.',
      '',
      'get_visitor_context IS EMPTY AFTER YOU SET SOMETHING. It reads empty until the brand',
      'has absorbed the turn, and answers in its own key names. Re-read it after the next',
      'turn before concluding it was ignored.'
    ].join('\n'),

    hard_rules: [
      'TOOLS ONLY. Never read or manipulate the page: no DOM queries, no innerText, no',
      'scraping markup, no screenshots. The tools are ground truth; the rendered page is',
      'not. When you need to know what is on screen, a read tool tells you.',
      '',
      'VERIFY THROUGH TOOLS. Confirm an action by its return value or by re-reading the',
      'relevant read tool — never by inspecting the page.',
      '',
      'NEVER INVENT CATALOG FACTS. No product, price, availability, or spec that did not',
      'come from get_products. This includes facts the SITE states: prose can lag the',
      'catalogue, and a price or an "in stock" written in copy has disagreed with the tools.',
      'Where they differ, the tool is right — and the disagreement is worth reporting rather',
      'than quietly resolving.',
      '',
      'AVAILABLE IS NOT AVAILABLE IN THEIR SIZE. A product reports available when ANY variant',
      'is; the size they asked for can still be sold out. Check the variant before you promise',
      'anything: get_products with that id, then look for a variant whose selections carry that',
      'size and whose available is true.',
      '',
      'RELAY, DO NOT REWRITE. The composing tools return the site\'s own prose. Pass it',
      'through.',
      '',
      'DISCOVER, DO NOT ASSUME. Use only what listTools() actually showed you. Tools can be',
      'enabled, disabled, or renamed per space. If the surface lacks something the goal',
      'needs, say so and stop rather than improvising against the page.'
    ].join('\n'),

    when_things_go_wrong: [
      'If a composing tool REJECTS saying the space has no live session, the storefront could',
      'not reach its AI at all — it may be locked or temporarily unavailable. Nothing was',
      'sent. Report that plainly and stop. Retrying will not help, and a different phrasing',
      'will not either.',
      '',
      'A compose call returns { status: "error", error, responseText } when the turn fails.',
      'Report the error and stop; do not loop. get_status.error carries session-level',
      'failures.',
      '',
      'An empty response with status "done" means the turn produced no prose. Do not paper',
      'over it with your own invented answer — say the site returned nothing and offer to',
      'try a different phrasing.',
      '',
      'A tool that throws is telling you the arguments were wrong. Read the message; it',
      'names the offending parameter.'
    ].join('\n')
  };

  /**
   * Short operating notes appended to specific tools' descriptions.
   *
   * These ride the one channel an agent cannot skip. Everything here is a fact
   * an agent will otherwise get WRONG rather than merely miss:
   *
   *   - the composing calls are slow, and the natural response to a slow call
   *     (retry it) silently queues a second turn against the same layout
   *   - the space's own description of send_message offers a keyword-shaped
   *     example, which is exactly the usage that wastes the capability
   *   - an agent that never calls the guide should still learn it exists
   *
   * Kept deliberately short. A description is read on every discovery pass, so
   * this is the most expensive text in the system — anything that is merely
   * useful belongs in the guide, not here.
   */
  var TOOL_NOTES = {
    send_message: [
      'OPERATING NOTES: Takes 5-20 seconds — await it, and never retry it or run two at once;',
      'a retry does not arrive sooner, it queues a SECOND turn against the same layout.',
      'Describe the shopper\'s situation and constraints rather than keywords ("wide-calf boots',
      'under $140 I can wear all day", not "boots"), and remember you can also ask for a',
      'PRESENTATION — "show me how they compare", "fewer options, with the trade-offs".',
      'Follow-ups refine the same session, so say what changes rather than restating.',
      'Call how_to_use_this_site first if you have not driven this site before.'
    ].join(' '),
    show_collection: [
      'OPERATING NOTES: Takes 5-20 seconds — await it, and never retry it or run two at once;',
      'a retry queues a second turn rather than arriving sooner.'
    ].join(' ')
  };

  /**
   * Append this tool's operating note, if it has one. Idempotent: a tool that
   * re-registers (StrictMode, HMR, session reset) must not accumulate copies.
   */
  function decorateDescription(name, description) {
    var note = TOOL_NOTES[name];
    if (note === undefined) return description;
    if (description.indexOf('OPERATING NOTES:') !== -1) return description;
    return description.length === 0 ? note : description + ' ' + note;
  }

  /** Section order for rendered output — narrative order, most useful first. */
  var ORDER = [
    ['WHAT THIS SITE IS', 'what_this_is'],
    ['THE THING THAT MATTERS', 'the_thing_that_matters'],
    ['THE TOOLS, BY JOB', null],
    ['HOW TO RUN A SESSION', 'how_to_run_a_session'],
    ['WRITING A GOOD PROMPT', 'writing_a_good_prompt'],
    ['WHAT ELSE YOU CAN ASK FOR', 'asking_for_more'],
    ['WHEN THE ANSWER LOOKS WRONG', 'when_it_does_not_look_right'],
    ['TIMING — READ THIS BEFORE YOU RETRY ANYTHING', 'timing'],
    ['IDS AND DATA SHAPES', 'data_shapes'],
    ['HARD RULES', 'hard_rules'],
    ['WHEN THINGS GO WRONG', 'when_things_go_wrong']
  ];

  var JOB_TITLES = {
    compose: 'COMPOSE — change what the storefront shows',
    read: 'READ — find out what is there',
    remember: 'REMEMBER — standing preferences the visitor stated',
    act: 'ACT — navigation and raw signals',
    buy: 'BUY — cart and checkout',
    reset: 'RESET — almost never'
  };

  /** Rendering order for the job groups. */
  var JOB_ORDER = ['compose', 'read', 'remember', 'act', 'buy', 'reset'];

  /** Render the guide as plain text, for `instructions` and /llms.txt. */
  function toText() {
    var out = ['AMS — HOW TO USE THIS SITE', '=========================='];
    for (var i = 0; i < ORDER.length; i++) {
      var heading = ORDER[i][0];
      var key = ORDER[i][1];
      out.push('', heading, new Array(heading.length + 1).join('-'), '');
      if (key !== null) {
        out.push(GUIDE[key]);
        continue;
      }
      for (var j = 0; j < JOB_ORDER.length; j++) {
        var job = GUIDE.tools_by_job[JOB_ORDER[j]];
        if (job === undefined) continue;
        out.push(JOB_TITLES[JOB_ORDER[j]]);
        out.push('  ' + job.tools.join(', '));
        out.push('');
        out.push(job.note);
        out.push('');
      }
    }
    return out.join('\n');
  }

  /**
   * Register the guide as a tool, so an agent scanning listTools() can find it
   * without being told it exists. `context` distinguishes the launcher (no
   * space open yet) from a brand page.
   */
  function registerTool(host, context) {
    var onLauncher = context === 'launcher';
    host.registerTool({
      name: 'how_to_use_this_site',
      description:
        'Read this first if you have not driven an AMS storefront before. Explains what this ' +
        'site is (a storefront that composes itself around a request, not a catalog with a ' +
        'search box), which tool does which job, how to phrase a request so the layout is ' +
        'built for the shopper rather than for a keyword, how long the composing calls take ' +
        'and why retrying them is wrong, and the shape of the ids and data the tools return. ' +
        'Takes no arguments and changes nothing.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: function () {
        return Promise.resolve({
          guide: GUIDE,
          text: toText(),
          where_you_are: onLauncher
            ? 'The home screen. No storefront is open yet — call start_shopping with the ' +
              "shopper's intent (or an id from list_intents). That navigates to the storefront, " +
              'which registers its own tools and submits the intent automatically, so the first ' +
              'layout composes with no further call.'
            : 'A live merchant space. Its tools are registered and ready; state an intent ' +
              'through send_message.',
          also_available_at: 'window.webmcp.instructions, and /llms.txt on this origin'
        });
      }
    });
  }

  window.PlaygroundAmsGuide = {
    data: GUIDE,
    toText: toText,
    registerTool: registerTool,
    decorateDescription: decorateDescription
  };
})();
