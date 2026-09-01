# WebMCP × AMS — Steve Madden

**WebMCP lets an agent act on a page. AMS gives it something worth building.**

```bash
git clone git@github.com:40RTY-ai/40rty-ams-webmcp-playground.git
cd 40rty-ams-webmcp-playground
node scripts/serve.mjs
```

Then open **http://localhost:4040**, copy the prompt from the overlay, and paste
it into your agent with that tab active.

No install, no build, no dependencies, no API keys. Node is the only requirement,
and it is used to serve one page.

---

## Why the two belong together

WebMCP is the browser API that lets a page declare its own tools on
`navigator.modelContext`, so an agent calls what a site offers instead of
guessing at its buttons. It answers *how does an agent act on the web*.

But point an agent at an ordinary storefront and those tools are only a better
remote control for a page somebody authored months ago. The protocol got
sharper; the page didn't move.

**This store has no authored pages.** It composes itself per request, over a real
catalogue, with the brand's own AI. So a tool call doesn't navigate the store — it
changes what the store *is*. Ask for a different palette and the occasion holds.
Move the venue and the palette survives. The agent isn't operating a storefront;
it's helping compose one.

That's the pairing this repo exists to show: **the protocol that lets an agent
act, on a surface that changes when it does.** Nineteen tools on one page, and an
inspector that logs every call as it lands, so the protocol is visible rather than
asserted.

## What you are looking at

The page is the **real Steve Madden storefront** — real brand shell, real
catalogue, the brand's own composing AI — with this repo's overlay on top of it.
The server reverse-proxies the live storefront and injects the demo's chrome, so
everything runs on one origin:

```
localhost:4040  ─proxy─►  app.40rty.ai/stevemadden
     │
     ├── the storefront's 16 WebMCP tools
     └── + how_to_use_this_site, get_demo_script, start_demo
         + the tool inspector, on the storefront itself
```

That last part is why it is a proxy rather than a page that links out. The
storefront is another origin, so nothing of ours can run on it — no inspector, no
guide, no overlay. An iframe would be worse: the storefront's tools would register
*inside the frame*, where a top-level agent cannot see them, silently costing the
whole point. Proxied, all 19 tools sit on one document.

The AMS API accepts a localhost origin, so the session and the agent WebSocket
work from here exactly as in production.

**The page starts on the store's own default layout, and nothing is added to the
URL** — no intent, no `?webmcp=1`, no redirect. Every layout you then see is
something the agent asked for, the first look included. That is the demo: five
beats, all of them a `send_message` on the page already open, nothing to navigate.

Two things the server does so the demo can't stumble:

- **It holds agent-backed calls until the storefront has a session.** The
  storefront registers its tools when its React app mounts, which is *before* the
  session exists — so a `send_message` fired the instant tools appear returns
  `TURN_FAILED / no_response`. The agent's first call lands exactly in that window.
  Gated, the same call returns 592 characters in 21.3s.
- **It degrades rather than breaks.** If an injection anchor is ever missing, the
  overlay is dropped and the storefront still serves — a demo without its overlay
  is recoverable, mangled HTML isn't. An unreachable upstream renders a page saying
  what failed and how to repoint it.

`UPSTREAM=https://host node scripts/serve.mjs` points it somewhere else; `PORT`
moves the port. Anything you do pass (`?intent=`, `?session=`) is forwarded
untouched.

> A website cannot talk to an agent. Only an agent can.

## What to try

The demo is not the first prompt — it's the second.

1. Pick **"My friend is getting married in Florida next month…"**. The store
   composes: a wedge that won't sink in sand, a heel for the reception, and the
   reasoning for both.
2. Then keep talking, in the storefront's own composer or through `send_message`:
   *"Flats for the beach instead."* — *"Now something for the reception."*

The layout rearranging itself around that second sentence is the thing no page
could have been authored for. Nothing was clicked. That is a new store.

## The guided demo

`assets/demo-script.js` carries a five-beat demo — **The Wedding That Kept
Changing**. It's on the home screen, and an agent can read it with
`get_demo_script`.

The arc is built on two pivots rather than incremental tightening, because a
pivot is what a filtered grid cannot survive:

| Beat | Said | What happens | Measured |
| --- | --- | --- | --- |
| 1 | *"A classic dinner wedding… the whole look: a dress, high heels, a clutch and jewellery."* | A hero look card over ~18 products | 24.6s — *"The Midnight Dinner Edit"*, Phia Dress $159 + Gorgina Champagne $249.95 + Leena Bag $88 + earrings |
| 2 | *"I'm a size 7 — only show me what I can actually buy."* | Size chip pins; the look holds | 8–11s |
| 3 | *"Actually, make the whole thing pink for the dinner."* | **Palette pivot** — dress, shoes and bag all change, occasion doesn't | 13–17s — *"The Pink Dinner Edit"* |
| 4 | *"Change of plans — it's a beach party now. Commit to one featured look: dress, shoes, bag and jewellery."* | **Occasion pivot** — stilettos and tulle go, the pink survives | 10–18s — *"The Pink Beach Party Edit"* |
| 5 | *"Add the shoes in my size."* | Cart settles with the named line | ~1.6s |

Naming the categories in beat 1 is what makes the first turn big: "a dress and
heels" composes a small card, the line above composes four categories over a
grid and rails.

### Waiting properly — the thing that otherwise ruins it

`send_message` **stops waiting at 15.00 seconds**, and these composing turns often
take 25–30. When that happens it returns at exactly 15.00s with empty text and
`status: "running"`. The turn has not failed; it is still composing. Measured: a
reply that came back empty at 15s was complete and 448 characters by ~30s.

So on `status: "running"`, poll `get_status` every 2–3s until `isRunning` is
false and read `latestResponse`. **Do not resend** — the turn already running is
the one doing the work, and a second would queue a second turn against the same
layout. The prompt, the shared guide and `check-demo.mjs` all do this; without it
an agent narrates "nothing happened" while the store visibly rebuilds.

### Ask for the look card, not for more scenario

The beach pivot's exact wording matters more than it looks. Three phrasings,
measured:

| Phrasing | Result |
| --- | --- |
| *"…it's a beach party now."* | A card, but only 3 slots — no jewellery. 27.7s |
| *"…Show it as one complete look I can buy."* | 4 slots, but the palette drifted — it picked a **clear** shoe for a pink look. 27.8s |
| *"…Commit to one featured look: dress, shoes, bag and jewellery."* | **4 slots, palette held, 17.7s** |

And an earlier attempt that elaborated on the *situation* instead — *"the wedding
moved to a beach party, rework the whole look for sand and heat"* — returned good
prose and **no look card at all**. More words about the scenario is not a clearer
instruction. Name the slots.

**If a pivot still lands as sections with no card**, don't buy from them. Ask the
store to commit first — *"Commit those pieces as one featured look I can buy."* —
then read the card. The prompt carries this recovery step.

**The beach beat flaked once** in four early runs (~5s, empty, nothing
recomposed), distinct from the 15s cap. Say so and send it again rather than
narrating a change that didn't occur.

### Where the flow state lives

The demo crosses a navigation to another origin, so the home screen cannot follow
you — and doesn't need to. The storefront reports its own state: `get_messages`
says which beats have been spoken, `get_visitor_context` which constraints the
brand actually registered, `get_cart` what was really bought. An agent that loses
its place re-reads those three and knows exactly where it is. That's better than
a counter this page would have to keep honest.

### Things to know before running it

- **Beat 1 must ride the URL.** The storefront registers its tools before its
  session exists, so a `send_message` on a cold page returns empty in about two
  seconds and nothing composes — the opening beat looks like a dud and the pink
  look only appears on beat 2. Delivered as `?intent=`, AMS waits for the session
  and submits properly. The home screen's **Start the demo** button does this.
- **The screen and an agent disagree on price.** At beat 5 the page read
  *"COMPLETE LOOK: $218.98"* while `get_products` returned every product on the
  canvas — alternates included — summing to $944.94. There is no tool for "the
  look" or its total, so an agent cannot quote the number the audience is reading.
- **The cart cannot be read back.** `add_to_cart` works and returns the resolved
  variant, but no tool reads the cart, so a claim about its contents can't be
  verified through the surface.

The last two are exactly what `AMS_AGENT_COMMERCE_WORKFLOWS.md` proposes to fix.

## The tool inspector

The panel in the corner is the point. WebMCP is invisible by nature — without
it, a reviewer with no agent attached sees a storefront and no evidence of a
protocol. The panel:

- announces the surface: **"WebMCP active · N tools registered"** (11 on the instrumented view, 3 on the home)
- lists every registered tool with its description and `inputSchema`
- logs every call as it lands — name, arguments, duration, result or error, and
  whether it came from the browser's own agent or a JavaScript client
- reports which host it found (a native one it wrapped, or its own polyfill)

## The tool surface

Sixteen tools come from the AMS space itself — on the storefront and on
`/instrumented` alike:

| Tool | What it does |
| --- | --- |
| `send_message` | Hands a natural-language prompt to the storefront's own AI, **awaits** it, and returns its response text. This is the one that composes and recomposes. Relay its text verbatim — it is the site AI speaking. |
| `show_collection` | Asks the AI to compose a named collection. |
| `get_products` | **Two shapes.** Bare, it surveys the canvas compactly. With `productIds`, it returns the full record — description, option axes, and every variant with its exact option values. |
| `get_layout` · `get_messages` · `get_status` | The layout tree, the conversation, and session state. |
| `get_visitor_context` · `set_visitor_context` | Standing preferences the visitor stated — size, fit, colour, budget. The brand answers in **its own key names**: state `{"Size":"7"}` to Steve Madden and it comes back as `beauty_size`. |
| `add_to_cart` | Adds by `productId` **plus `{axis: value}` selections**. Without selections the page picks a variant, which may not be the size they meant. |
| `get_cart` | The lines with their selections, totals, and `checkoutAvailable`. The only confirmation an add worked. |
| `update_cart_item` · `remove_from_cart` | Quantity is **absolute**, not a delta. Removing without selections removes *every* line of that product. |
| `begin_checkout` | Hands off to secure checkout. Only once they've said they want to buy. |
| `open_product` · `send_signal` · `clear_session` | Navigation, raw signals, and reset. |

**Variant ids are deliberately withheld.** They're unstable across the
optimistic-write window, so an id held across a beat can aim a write at a line
that's already been replaced. Cart verbs bind product × selections late, against
live state — a stale reference can only *miss* and fail loudly. Writes are
stamped `origin: 'webmcp'`.

The playground adds one more, registered *before* the space's tools so that an
agent scanning `listTools()` meets it first:

| Tool | What it does |
| --- | --- |
| `how_to_use_this_site` | Returns the AMS guide — what this kind of site is, which tool does which job, how to phrase a request, how long the composing calls take, and the shape of the ids and data. Takes no arguments, changes nothing. |

The home screen registers `how_to_use_this_site` plus two of its own, so that
starting a conversation is on-protocol rather than the one step that happens
outside it:

| Tool | What it does |
| --- | --- |
| `list_intents` | The four example intents, each written the way a shopper actually talks. |
| `start_shopping` | Opens the storefront with an intent — one of the four, or free text of your own. Navigates to a new document, submits the intent automatically, and that document registers the storefront's tools. Re-run discovery afterwards. |
| `start_demo` | Runs beat 1 of the guided demo and returns the remaining beats. |
| `get_demo_script` | The six-beat demo as an executable plan: the sentence, the tool calls, how to verify it landed, and how long it took when measured. |

Actions route through the same signal handlers the UI uses, so a tool call and a
click hit identical code. Reads return live session state.

## Instructions for the agent

An agent that reads only a behavioural contract knows the *rules* and nothing
about the *capability* — so it treats `send_message` as a search box, types
"boots", gets a competent answer, and never discovers that it can ask for a
presentation rather than a filter. The guide in `assets/ams-guide.js` is the part
that closes that gap. It covers:

- **What this kind of site is** — composed per request, no authored pages, so
  describe the shopper's situation rather than a keyword
- **That follow-ups recompose** — the session accumulates context, so say what
  changes rather than restating everything
- **The tools grouped by job** — compose (agent-backed, awaits, returns the
  site's prose) / read / act / reset
- **How to phrase a request** — intent *and* presentation, with worked examples
  and the phrasings that don't work
- **Timing** — composing calls take 5–20s; retrying queues a second turn rather
  than arriving sooner, which is the single most damaging thing an agent can do here
- **Ids and data shapes** — `gid://` forms, what each tool returns, and that
  `responseText` is non-empty only mid-turn while `latestResponse` is committed
- **Hard rules** — tools only, never invent catalog facts, relay the site's prose
- **Failure handling** — what an errored or empty turn means, and not to loop

### What else the guide tells an agent

Two sections exist because a live AI over a live catalogue can answer in the
wrong *shape* without anything having failed, and an agent that doesn't know
that works around it instead of asking:

**What else you can ask for** — the capabilities agents routinely never try.
Ask for a *shape* ("show me how these compare", "fewer, with the trade-offs").
Ask it to **commit a look** when a page is browsable but not buyable. Ask for one
slot to change and leave the rest. State a standing constraint once and it
survives every later recomposition.

**When the answer looks wrong** — situation to response, all observed:

| What you see | What to do |
| --- | --- |
| Sections but no committed look | *"Commit those pieces as one featured look I can buy."* Don't cart from a section |
| The look is missing a slot | Name what's absent — *"add a bag and jewellery to that look"* |
| A featured item is sold out in her size | Say which, ask for a swap. **Never cart a substitute the page never showed** |
| Copy and catalogue disagree on a price | Trust the tool, say both out loud |
| Empty reply, `status: "running"` | Not a failure — poll `get_status`, don't resend |
| Empty reply, fast, `isRunning: false` | That one really produced nothing. Say so, send once more |
| Layout changed but you have no prose | Read `get_messages` — the reply may have committed after your call returned |
| `get_visitor_context` empty after setting | It hasn't absorbed the turn yet; re-read after the next one |

The habit underneath all of it: when the store gives you something you can't
use, **ask it for what's missing** rather than working around it. It will do it,
and the asking is itself the demo.

### How do we know an agent actually gets them?

Only one channel is guaranteed, and it is worth being precise about which:

| Channel | Reaches a native agent? |
| --- | --- |
| Tool `name` + `description` + `inputSchema` | **Guaranteed.** An agent must read these to call anything at all. |
| `how_to_use_this_site` tool | **Sees it, always** — it is on the registry and registered first. *Calling* it is still the agent's choice. |
| `window.webmcp.instructions` | **No.** Not part of the registry contract. A native WebMCP agent never reads it; only a JavaScript-capable agent told to look there. |
| `/llms.txt` | **No.** Only if the agent chooses to read the site before driving it. |

So the handful of facts an agent will otherwise get *wrong* — rather than merely
miss — ride the guaranteed channel. As each tool passes through the host, a short
`OPERATING NOTES:` clause is appended to `send_message` and `show_collection`
covering the 5–20s latency and the retry trap, intent-over-keywords, that you can
ask for a presentation, that follow-ups refine, and that the guide exists. Nothing
else is touched, and re-registration does not stack copies.

That is a deliberate intervention on what the space declares. It is done here
because the playground is the client and this is the only channel with a hard
guarantee — but the durable home for it is the tool definitions in AMS itself.

Verify any of this yourself, on any brand page, with no tooling:

```js
PlaygroundWebMCP.selfCheck()
```

It reports the host mode, which tools carry the notes, where the guide sits in
the registry, and the caveat on each opt-in channel.

The guide's full text still reaches an agent three ways, all from that one source:

| Where | What it carries |
| --- | --- |
| `window.webmcp.instructions` | The operating contract **plus** the guide, with the goal slot last. This is what the inspector's "Copy agent instructions" button hands you. |
| `how_to_use_this_site` | The same guide, structured and discoverable through `listTools()` — no one has to know it exists. |
| [`/llms.txt`](llms.txt) | The same guide as a static document, for an agent or crawler that reads the site before driving it. |

`llms.txt` is generated, not hand-written — three hand-maintained copies of one
document is three chances to drift:

```bash
node scripts/gen-llms-txt.mjs    # after editing assets/ams-guide.js
```

Everything the guide asserts comes from the registered tool surface itself or was
measured against the live deployment. Keep it that way: an agent-facing document
that drifts from the tools is worse than none, because the agent will trust it
over what it can see.

## How the host works

The playground installs its own instrumented host on `navigator.modelContext`
**before** the AMS embed loader boots, then injects the loader. Two cases:

- **A real host is present** — ChatGPT's browser, Chrome behind the flag, or a
  bridge extension. The playground **wraps** it: every `registerTool` is
  recorded here *and* forwarded to the real host, with `execute` instrumented on
  the way through. Tools reach the agent exactly as they would otherwise; the
  inspector just gets to watch. Replacing the host would shadow the registry the
  agent actually reads and the page would look broken to it.
- **No host is present** — the playground *is* the host, and also installs a
  `window.webmcp` client so any agent that can run JavaScript can drive the page:

```js
await window.webmcp.listTools();
await window.webmcp.callTool('send_message', { message: 'wide-fit boots under $140' });
window.webmcp.instructions;   // the operating contract for an external agent
```

Copy that contract straight from the inspector panel and paste it into a
JS-capable browser agent.

Because tools register whenever a host exists, the surface comes up **with or
without** `?webmcp=1`. The flag stays supported for parity with AMS (it also
reveals the embed's own copy-prompt pill), but dropping it costs you nothing.

## Query flags

| Flag | Effect |
| --- | --- |
| `?webmcp=1` | Parity with AMS; also shows the embed's own copy-prompt pill. Not required. |
| `?inspector=left` | Dock the panel left. On the instrumented view the default right position covers the space's own composer rail. |
| `?inspector=off` | Hide the panel, for a clean storefront-only shot. |
| `?api=<url>` | Retarget the AMS API *and* the embed loader together. For a staging or cold-machine check; the submitted URL never needs it. |

## The static pages (secondary)

`index.html` and `space.html` are the earlier flow: a static home screen that
hands off to the storefront in a new tab, plus an embedded view at
`/instrumented`. They still work and they deploy to static hosting, which the
proxy cannot. The proxy is the better demo — one origin, no handoff, the
inspector on the storefront itself — so it is what `serve.mjs` serves now. Keep
these for a shareable URL if one is needed.

## Older notes on running it

No build, no dependencies, no secrets. Node is used only to serve files.

```bash
node scripts/serve.mjs        # http://localhost:4040
```

The server mirrors the one rewrite in `vercel.json` (`/instrumented` →
`space.html`), which matters because the space is resolved from
`location.pathname`. Whether the page can reach the API from here depends on
that deployment accepting a localhost origin — see Deploying below.

## Deploying — read this first

This repo is a **thin client over a live AMS deployment**. It ships no catalog
and no composer of its own: products, layouts and the composing AI all come from
the AMS API, and the embed bundle itself is served from there (one self-contained
file carrying React, the SDK, the component library and the compiled stylesheet).
Clone-and-run works, but only against a reachable AMS.

Point it at yours in one place — `assets/config.js`:

```js
window.PLAYGROUND_CONFIG = { apiBaseUrl: 'https://<your-ams-api>' };
```

**The origin you serve this from must be accepted by that API.** The same
browser-origin check gates both the session request and the WebSocket upgrade
that carries the agent channel, so on a hostname the API does not accept, the
storefront never boots — and it fails quietly, which is the worst way for a demo
to fail. Serve the playground from a hostname your AMS deployment already
accepts rather than a fresh, unrelated one, and confirm it before you trust it:

```bash
curl -si -X OPTIONS https://<your-ams-api>/s/<space-slug> \
  -H "Origin: https://<your-host>" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

No `Access-Control-Allow-Origin` in the response means that origin is refused.
Check it again from a machine with no extensions and no browser flags before
sharing the link.

## Layout

```
index.html            the home screen — what AMS is, four intents, free text
space.html            the instrumented view (/instrumented)
llms.txt              the guide as a static document — GENERATED, do not hand-edit
assets/
  config.js           deployment values: the AMS API, and the storefront URL
  intents.js          the four intents, and how an intent becomes a storefront URL
  brands.js           the space the instrumented view embeds
  ams-guide.js        what AMS is and how to drive it — the agent-facing guide
  operator-prompt.js  the operating contract (mirrored) + guide composition
  webmcp-host.js      instrumented host — wraps a real one, or polyfills
  inspector.js        the visible tool + call-log panel
  home-boot.js        the home screen and its tool surface
  space-boot.js       instrumented view: host → gate → guide → inspector → embed
  home.css            home screen styling
scripts/
  serve.mjs           zero-dependency local server, mirrors the Vercel rewrite
  gen-llms-txt.mjs    regenerates llms.txt from ams-guide.js
vercel.json           the /instrumented rewrite and cache headers
```

Every script is a classic, un-deferred `<script>` so execution order is exactly
source order. That is load-bearing: the host must be installed before anything
can call `registerTool`, and `type="module"` implies `defer`.

## License

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
