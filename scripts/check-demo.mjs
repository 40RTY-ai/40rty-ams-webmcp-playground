/**
 * Automated demo checks.
 *
 * The demo's conversational beats were never the fragile part — composition
 * held up across every pivot. What broke trust was data consistency at the
 * moment the demo turned from inspiration into purchase: a featured shoe that
 * was sold out in the shopper's size, a price quoted in prose that disagreed
 * with the catalogue, and a total computed from both. Those are exactly the
 * failures a person cannot spot live and a script can.
 *
 * So this runs the demo end to end against the live storefront and asserts what
 * a viewer would otherwise have to take on faith:
 *
 *   1. every featured item is buyable in the stated size, at VARIANT level
 *   2. prices written on the page match what the catalogue tools report
 *   3. the look's total equals the sum of the featured items
 *   4. the shoe that gets carted is the shoe that was on screen
 *
 * "Featured" means the look card, not the canvas: get_products returns the
 * grids and rails too, so the outfit would otherwise be ambiguous. The look
 * card's own product list is the closest thing to an authoritative "current
 * look" until a tool exposes one.
 *
 * Needs Playwright, which this repo does not depend on — the playground itself
 * stays zero-dependency and this is a QA tool. Point PLAYWRIGHT at an install
 * if it is not resolvable:
 *
 *   node scripts/check-demo.mjs
 *   PLAYWRIGHT=/path/to/@playwright/test node scripts/check-demo.mjs
 */

const SIZE = '7';
const OPENING =
  'I have a classic dinner wedding next month. I need the whole look: a dress, high heels, a clutch and jewellery.';
const BEATS = [
  "I'm a size " + SIZE + ' — only show me what I can actually buy.',
  'Actually, make the whole thing pink for the dinner.',
  // Names the slots on purpose. Being explicit about the LOOK CARD is what makes
  // the store commit to one buyable look; being verbose about the SCENARIO
  // instead returned good prose and no look card at all.
  "Change of plans — it's a beach party now. Commit to one featured look: dress, shoes, bag and jewellery.",
];

const STOREFRONT = process.env.STOREFRONT ?? 'https://app.40rty.ai/stevemadden';

async function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT,
    'playwright',
    '@playwright/test',
    '/Users/tamired/WS/ams/node_modules/.pnpm/@playwright+test@1.59.1/node_modules/@playwright/test/index.js',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const mod = await import(c);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'Playwright not found. Install it, or set PLAYWRIGHT to a resolvable @playwright/test entry point.',
  );
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const money = (m) => (m && typeof m.amount === 'number' ? m.amount : null);

async function main() {
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const call = (name, args = {}) =>
    page.evaluate(
      ([n, a]) => window.webmcp.callTool(n, a).then((v) => v, (e) => ({ __error: String(e.message) })),
      [name, args],
    );

  console.log(`\nopening ${STOREFRONT}`);
  await page.goto(`${STOREFRONT}?webmcp=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.webmcp && window.webmcp.listTools().length >= 16, { timeout: 60000 });

  // The storefront registers its tools before its session exists, so a
  // send_message fired the instant they appear comes back TURN_FAILED. Wait for
  // the session rather than racing it — the demo server gates this for an agent,
  // but this script talks to the storefront directly.
  for (let i = 0; i < 60; i++) {
    const st = await call('get_status');
    if (st.sessionId) break;
    await page.waitForTimeout(500);
  }

  // Beat 1 is a message like every other beat.
  console.log(`  beat 1: "${OPENING.slice(0, 46)}…"`);
  const first = await call('send_message', { message: OPENING });
  let composed = String(first.responseText ?? '').length > 0;
  if (!composed) {
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2500);
      const st = await call('get_status');
      if (!st.isRunning) { composed = String(st.latestResponse ?? '').length > 0; break; }
    }
  }
  check('the first look composed', composed, composed ? '' : JSON.stringify(first).slice(0, 120));

  // Snapshot the look card after each beat, so the pivots can be asserted
  // rather than admired: a pivot that returns lovely prose and changes nothing
  // is the failure mode worth catching.
  const lookAfter = (l) => {
    let out = { title: '', products: [] };
    const walk = (v) => {
      if (v && typeof v === 'object') {
        if (v.type === 'lookCard' && v.props) {
          out = { title: v.props.title ?? '', products: v.props.products ?? [] };
        }
        for (const child of Object.values(v)) walk(child);
      }
    };
    walk(l);
    return out;
  };

  const snapshots = [lookAfter(await call('get_layout'))];
  await call('set_visitor_context', { context: { Size: SIZE } });
  for (const [i, beat] of BEATS.entries()) {
    const t0 = Date.now();
    const r = await call('send_message', { message: beat });
    let secs = ((Date.now() - t0) / 1000).toFixed(1);
    let prose = String(r.responseText ?? '').length;

    // send_message gives up waiting at 15s and says so with status "running".
    // The turn is still composing, so finish the wait rather than recording a
    // failure that is really a timeout.
    let timedOut = false;
    if (r.status === 'running' || (prose === 0 && Number(secs) >= 14.5)) {
      timedOut = true;
      for (let k = 0; k < 20; k++) {
        await page.waitForTimeout(2500);
        const st = await call('get_status');
        if (!st.isRunning) {
          prose = String(st.latestResponse ?? '').length;
          break;
        }
      }
      secs = ((Date.now() - t0) / 1000).toFixed(1);
    }

    console.log(`  beat ${i + 2}: ${secs}s  ${prose}ch${timedOut ? '  (waited past the 15s cap)' : ''}  "${beat.slice(0, 42)}…"`);
    if (r.__error) check(`beat ${i + 2} ran`, false, r.__error);
    else if (prose === 0) check(`beat ${i + 2} produced a reply`, false, `still empty after ${secs}s`);
    snapshots.push(lookAfter(await call('get_layout')));
  }

  // Beat 3 is the palette pivot, beat 4 the occasion pivot. Both must move the
  // look, not merely describe a move.
  const same = (a, b) => a.products.length === b.products.length &&
    a.products.every((id) => b.products.includes(id));

  // A pivot that DELETES the look card would otherwise pass the change test —
  // an empty product list differs from a full one. Survival of the card is the
  // point: sections with nothing committed cannot be bought from.
  for (const [i, label] of [[2, 'palette'], [3, 'occasion']]) {
    check(
      `the ${label} pivot left a committed look`,
      snapshots[i].products.length > 0,
      snapshots[i].products.length
        ? `"${snapshots[i].title}", ${snapshots[i].products.length} items`
        : 'the look card is gone — only sections, nothing to buy',
    );
    check(
      `the ${label} pivot changed the look`,
      !same(snapshots[i - 1], snapshots[i]),
      `"${snapshots[i - 1].title}" -> "${snapshots[i].title}"`,
    );
  }

  // --- the canvas survey must return ids that are actually ids ---
  //
  //     A broad get_products() has returned entries whose id was an image URL,
  //     which fails the follow-up detail request and costs the agent a retry it
  //     should never have needed. Malformed ids are worth failing loudly on: the
  //     survey is the entry point to everything downstream.
  const survey = await call('get_products');
  const surveyList = Array.isArray(survey) ? survey : (survey.products ?? []);
  const GID = /^gid:\/\/[^/]+\/Product\/[^/]+$/;
  const malformed = surveyList.filter((p) => typeof p.id !== 'string' || !GID.test(p.id));
  check(
    'every id from the canvas survey is a product id',
    malformed.length === 0,
    malformed.length
      ? `${malformed.length}/${surveyList.length} malformed, e.g. ${String(malformed[0].id).slice(0, 78)}`
      : `${surveyList.length} checked`,
  );

  // --- the featured look, from the look card rather than the whole canvas ---
  const layout = await call('get_layout');
  const nodes = JSON.stringify(layout);
  let featured = [];
  try {
    const found = [];
    const walk = (v) => {
      if (v && typeof v === 'object') {
        if (v.type === 'lookCard' && v.props && Array.isArray(v.props.products)) found.push(...v.props.products);
        for (const child of Object.values(v)) walk(child);
      }
    };
    walk(layout);
    featured = [...new Set(found)];
  } catch { /* fall through to the check below */ }
  check('a featured look exists', featured.length > 0, `${featured.length} item(s) in the look card`);
  if (featured.length === 0) {
    console.log('  (no look card — the remaining checks need one)');
    await browser.close();
    return report();
  }

  const detail = await call('get_products', { productIds: featured });
  const detailed = Array.isArray(detail) ? detail : (detail.products ?? []);

  // 1. every featured item buyable in the stated size, at VARIANT level.
  //
  //    Only the items that COME in that size are held to it — a bag or a pair of
  //    sunglasses is one-size, and failing them for lacking a size 7 would be
  //    noise. Noise is how a check like this gets ignored, and being ignored is
  //    the only way it can fail at its job.
  const sized = [];
  const oneSize = [];
  for (const p of detailed) {
    const axis = (p.options ?? {}).Size;
    if (Array.isArray(axis) && axis.includes(SIZE)) sized.push(p);
    else oneSize.push(p);
  }
  const soldOut = sized.filter(
    (p) => !(p.variants ?? []).some((v) => v.available && v.selections && v.selections.Size === SIZE),
  );
  check(
    `every featured item that comes in size ${SIZE} is buyable in it`,
    soldOut.length === 0,
    soldOut.length
      ? `sold out in ${SIZE}: ${soldOut.map((p) => p.title).join(', ')}`
      : `${sized.length} sized item(s) checked, ${oneSize.length} one-size`,
  );
  const oneSizeOut = oneSize.filter((p) => p.available !== true);
  check(
    'every one-size featured item is available',
    oneSizeOut.length === 0,
    oneSizeOut.length ? `unavailable: ${oneSizeOut.map((p) => p.title).join(', ')}` : `${oneSize.length} checked`,
  );

  // 1b. the look card's own copy must only name products in the look card.
  //
  //     The rationale has called one shoe the hero while the look card held a
  //     different one. That is the visual story and the transactional story
  //     disagreeing in the same component, and a shopper reading the copy would
  //     be looking for a product that is not there.
  let rationale = '';
  const lookTitles = detailed.map((p) => String(p.title));
  try {
    const walkR = (v) => {
      if (v && typeof v === 'object') {
        if (v.type === 'lookCard' && v.props && typeof v.props.rationale === 'string') rationale = v.props.rationale;
        for (const child of Object.values(v)) walkR(child);
      }
    };
    walkR(layout);
  } catch { /* checked below */ }

  if (rationale.length === 0) {
    check('the look card explains itself', false, 'no rationale on the look card');
  } else {
    // Compare on leading words: copy writes "Larina", the catalogue says
    // "LARINA PINK SATIN". Only flag a capitalised word that names a product
    // this space sells but which is NOT in the look.
    const leads = new Set(lookTitles.map((t) => t.split(/\s+/)[0].toUpperCase()));
    const canvasLeads = new Map();
    for (const p of surveyList) {
      const lead = String(p.title).split(/\s+/)[0].toUpperCase();
      if (!leads.has(lead)) canvasLeads.set(lead, p.title);
    }
    const strays = [];
    for (const [lead, title] of canvasLeads) {
      if (lead.length < 4) continue;
      const re = new RegExp('\\b' + lead + '\\b', 'i');
      if (re.test(rationale)) strays.push(title);
    }
    check(
      'the look card names only products it contains',
      strays.length === 0,
      strays.length ? `copy names ${strays.join(', ')}, which are not in the look` : `${lookTitles.length} in the look`,
    );
  }

  // 2. a price the copy attaches to a NAMED product must be that product's price.
  //
  //    Attribution matters. Scanning for every "$" in the prose flags the budget
  //    the shopper set and the total the stylist worked out, neither of which is
  //    a product price — and a check that cries wolf teaches people to skip it.
  //    So each featured product is looked for by name, and only a price written
  //    near its name is compared.
  const msgs = await call('get_messages');
  const arr = Array.isArray(msgs) ? msgs : (msgs.messages ?? []);
  const prose = arr.filter((m) => m.role === 'assistant').map((m) => m.text).join('\n');
  const flat = prose.replace(/\*\*/g, '');
  const toolPrices = detailed.map((p) => money(p.price)).filter((n) => n !== null);

  // The parts sum, computed up front: copy legitimately writes the look total
  //   beside a product name ("the Kola flatform, bringing the look to $112.98"),
  //   and reading that as the Kola's price is a false alarm. A number equal to
  //   the total is a total, whoever it sits next to.
  const partsSum = toolPrices.reduce((a, b) => a + b, 0);

  const mismatches = [];
  let attributed = 0;
  for (const p of detailed) {
    const price = money(p.price);
    if (price === null) continue;
    // Products are written by their leading words rather than the full SKU-ish
    // title ("Larina" for LARINA PINK SATIN), so match on the first word.
    const lead = String(p.title).split(/\s+/)[0];
    if (lead.length < 3) continue;
    const re = new RegExp(lead + '[^.$]{0,80}\\$(\\d+(?:\\.\\d{2})?)', 'i');
    const hit = flat.match(re);
    if (hit === null) continue;
    const quotedNear = Number(hit[1]);
    if (Math.abs(quotedNear - partsSum) < 0.02) continue; // it is the look total
    attributed += 1;
    if (Math.abs(quotedNear - price) >= 0.005) {
      mismatches.push(`${p.title}: copy says $${hit[1]}, catalogue says $${price}`);
    }
  }
  check(
    'a price the copy attaches to a product is that product\'s price',
    mismatches.length === 0,
    mismatches.length ? mismatches.join('; ') : `${attributed} attributed price(s) checked`,
  );

  // 3. the look total equals the sum of the featured items
  const sum = toolPrices.reduce((a, b) => a + b, 0);
  const stated = (flat.match(/(?:total|comes to|altogether|lands at)[^$]{0,28}\$(\d+(?:\.\d{2})?)/i) ?? [])[1];
  check(
    'the look total equals its parts',
    stated === undefined || Math.abs(Number(stated) - sum) < 0.02,
    stated === undefined ? `no total stated; parts sum to $${sum.toFixed(2)}` : `stated $${stated} vs parts $${sum.toFixed(2)}`,
  );

  // 4. the carted shoe is the shoe that was on screen
  const shoe = sized[0];
  if (shoe === undefined) {
    check(`a featured item comes in size ${SIZE}`, false, 'nothing in the look offers that size');
  } else {
    const variant = (shoe.variants ?? []).find((v) => v.available && v.selections && v.selections.Size === SIZE);
    if (variant === undefined) {
      check(`the featured shoe can be carted in size ${SIZE}`, false, `${shoe.title} has no available size ${SIZE}`);
    } else {
      await call('add_to_cart', { productId: shoe.id, selections: variant.selections });
      let cart = { empty: true };
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(2000);
        cart = await call('get_cart');
        if (!cart.empty) break;
      }
      const line = (cart.lines ?? [])[0];
      check('the add reached the cart', !cart.empty, cart.empty ? 'cart still empty after 16s' : `${cart.lines.length} line(s)`);
      if (line) {
        check(
          'the carted item is the featured one',
          line.productId === shoe.id,
          `carted ${line.title}, featured ${shoe.title}`,
        );
        check(
          'the carted price matches the catalogue',
          Math.abs(money(line.unitPrice) - money(shoe.price)) < 0.005,
          `cart $${money(line.unitPrice)} vs catalogue $${money(shoe.price)}`,
        );
      }
    }
  }

  await browser.close();
  return report();
}

function report() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nfailed:');
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
  }
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('\ncheck-demo failed to run:', err.message);
  process.exitCode = 2;
});
