/**
 * The demo server. One command, one URL, no build, no dependencies.
 *
 *   node scripts/serve.mjs
 *   → http://localhost:4040
 *
 * WHAT IT ACTUALLY DOES, AND WHY
 *
 * It reverse-proxies the live Steve Madden storefront and injects this repo's
 * overlay into it. So the page you open IS the real storefront — the real brand
 * shell, the real composing AI, the real catalogue — with the demo's
 * instructions on top of it.
 *
 * The alternative would be a page of our own that links out to the storefront,
 * and that is what this replaced. Two reasons it is worth a proxy:
 *
 *  1. ONE ORIGIN. The storefront is on another origin, so nothing of ours can
 *     run on it — not the tool inspector, not the guide tools, not an overlay.
 *     Served through here it is same-origin, so all of that finally sits on the
 *     storefront itself rather than on a page beside it.
 *
 *  2. NO IFRAME. An iframe would also be same-origin-ish but would register the
 *     storefront's WebMCP tools INSIDE the frame, where a top-level agent
 *     cannot see them. That silently costs the entire point of the demo.
 *
 * The coupling is deliberately thin: append script tags to the upstream HTML and
 * pass everything else through untouched. If the injection point ever moves, the
 * overlay is dropped and the storefront still works — see `injectInto`.
 *
 * A note on why localhost is enough: the AMS API accepts a localhost origin, so
 * the storefront's session request and its agent WebSocket work from here
 * exactly as they do in production.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? process.argv[2] ?? 4040);

/** The storefront this demo is about. */
const UPSTREAM = process.env.UPSTREAM ?? 'https://app.40rty.ai';
const SPACE_PATH = process.env.SPACE_PATH ?? '/stevemadden';

/** Our own files live under this prefix so they cannot collide with upstream. */
const ASSET_PREFIX = '/__pg/';

/**
 * Injected into <head>: everything that must exist BEFORE the storefront
 * registers its tools. Scripts are legal in head and React does not hydrate
 * them, so this is safe — unlike markup, see `BODY_SCRIPTS`.
 */
const HEAD_SCRIPTS = [
  'config.js',
  'ams-guide.js',
  'operator-prompt.js',
  'webmcp-host.js',
  'proxy-boot.js',
];

/**
 * Injected before </body>: the visible chrome. It must NOT be markup — a stray
 * element in the server-rendered tree breaks Next's hydration (React #418), and
 * a <div> placed in <head> is relocated by the browser, which is the same bug
 * wearing a hat. These build their DOM from script after load, so Next never
 * sees anything it did not render.
 */
const BODY_SCRIPTS = ['inspector.js', 'demo-script.js', 'overlay.js'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

function tags() {
  const head = HEAD_SCRIPTS.map((f) => `<script src="${ASSET_PREFIX}${f}"></script>`).join('');
  const body =
    `<link rel="stylesheet" href="${ASSET_PREFIX}inspector.css">` +
    `<link rel="stylesheet" href="${ASSET_PREFIX}overlay.css">` +
    BODY_SCRIPTS.map((f) => `<script src="${ASSET_PREFIX}${f}"></script>`).join('');
  return { head, body };
}

/**
 * Put our scripts into the upstream HTML.
 *
 * Deliberately forgiving: if either anchor is missing, that half is skipped and
 * the storefront is served unchanged rather than mangled. A demo that loses its
 * overlay is recoverable; one that serves broken HTML is not.
 */
function injectInto(html) {
  const { head, body } = tags();
  let out = html;
  if (out.includes('</head>')) out = out.replace('</head>', head + '</head>');
  else console.warn('[demo] no </head> in upstream HTML — host scripts not injected');
  if (out.includes('</body>')) out = out.replace('</body>', body + '</body>');
  else console.warn('[demo] no </body> in upstream HTML — overlay not injected');
  return out;
}

/** Serve one of our own files. */
async function serveAsset(res, pathname) {
  const relative = 'assets/' + pathname.slice(ASSET_PREFIX.length);
  const target = normalize(join(ROOT, relative));
  if (!target.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    const type = TYPES[extname(target)];
    res.writeHead(200, {
      'content-type': type === undefined ? 'application/octet-stream' : type,
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found: ' + relative);
  }
}

/**
 * Where a request goes upstream.
 *
 * Nothing is added and nothing is redirected. The visitor lands on the store's
 * own default page at a clean `http://localhost:PORT/`, and the AGENT composes
 * the first look — the demo's opening beat is a send_message like every other
 * beat, so there is no query string to arrange and no hop to explain.
 *
 * `?webmcp=1` is not needed either: it exists to make the storefront install a
 * host when none is present, and by the time its app mounts we have already
 * installed one. Measured — nineteen tools register on a bare URL. Anything the
 * visitor does pass (`?intent=`, `?session=`) is forwarded untouched.
 */
function upstreamUrl(url) {
  const path = url.pathname === '/' ? SPACE_PATH : url.pathname;
  return UPSTREAM + path + (url.search || '');
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname.startsWith(ASSET_PREFIX)) {
    await serveAsset(res, url.pathname);
    return;
  }

  const target = upstreamUrl(url);
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        'user-agent': req.headers['user-agent'] ?? 'node',
        accept: req.headers.accept ?? '*/*',
        'accept-language': req.headers['accept-language'] ?? 'en',
      },
      redirect: 'follow',
    });

    const type = upstream.headers.get('content-type') ?? 'application/octet-stream';

    if (type.includes('text/html')) {
      const html = await upstream.text();
      const body = injectInto(html);
      res.writeHead(upstream.status, { 'content-type': type, 'cache-control': 'no-store' });
      res.end(body);
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    const headers = { 'content-type': type };
    const cache = upstream.headers.get('cache-control');
    if (cache !== null) headers['cache-control'] = cache;
    res.writeHead(upstream.status, headers);
    res.end(buffer);
  } catch (err) {
    // Say what failed and where, because the alternative is a blank page and a
    // guess about whose fault it is.
    console.error('[demo] upstream failed:', target, '—', err.message);
    res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Storefront unreachable</title>` +
        `<body style="font:15px/1.6 system-ui;max-width:44em;margin:12vh auto;padding:0 6vw;color:#111">` +
        `<h1 style="font-size:20px">The storefront could not be reached</h1>` +
        `<p>This demo proxies <code>${UPSTREAM}${SPACE_PATH}</code>, and that request failed:</p>` +
        `<pre style="background:#f4f4f4;padding:12px;overflow:auto">${err.message}</pre>` +
        `<p>Check your network, then reload. Point elsewhere with ` +
        `<code>UPSTREAM=https://host node scripts/serve.mjs</code>.</p></body>`,
    );
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  AMS demo — Steve Madden, running on AMS');
  console.log('');
  console.log(`  Open:      http://localhost:${PORT}`);
  console.log(`  Proxying:  ${UPSTREAM}${SPACE_PATH}`);
  console.log('');
  console.log('  The page is the real storefront with this repo\'s overlay on top.');
  console.log('  Copy the prompt from the overlay into your agent — it runs the whole demo,');
  console.log('  first look included, so the page starts on the store\'s own default layout.');
  console.log('');
});
