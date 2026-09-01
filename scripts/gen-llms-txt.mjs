/**
 * Generate llms.txt from assets/ams-guide.js.
 *
 * The guide has to reach an agent three ways — `window.webmcp.instructions`, the
 * `how_to_use_this_site` tool, and this file — and three hand-maintained copies
 * of the same document is three chances to drift. So the JS module is the single
 * source and this writes the static file from it.
 *
 * The output is committed, because the deployment is plain static hosting with
 * no build step. Re-run after editing the guide:
 *
 *   node scripts/gen-llms-txt.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const GUIDE_PATH = fileURLToPath(new URL('assets/ams-guide.js', ROOT));
const OUT_PATH = fileURLToPath(new URL('llms.txt', ROOT));

// The guide is a browser classic script that assigns onto `window`. Give it a
// window and evaluate it — cheaper and less brittle than parsing it.
const source = await readFile(GUIDE_PATH, 'utf8');
const win = {};
new Function('window', source)(win);

if (!win.PlaygroundAmsGuide || typeof win.PlaygroundAmsGuide.toText !== 'function') {
  throw new Error('assets/ams-guide.js did not define window.PlaygroundAmsGuide.toText');
}

const body = [
  '# Steve Madden on AMS',
  '',
  'A storefront that composes itself around what a shopper asks for. It declares its',
  'tools on `navigator.modelContext`, so any agent can discover and call them. There',
  'are no authored pages: the layout is composed per request by the store\'s own AI',
  'over the real Steve Madden catalog.',
  '',
  '## How to drive it',
  '',
  'If your browser exposes WebMCP, the tools are already registered on this document.',
  'If you can run JavaScript, this origin also serves a client:',
  '',
  '    await window.webmcp.listTools()',
  '    await window.webmcp.callTool("how_to_use_this_site", {})',
  '    window.webmcp.instructions   // full operating contract + the guide below',
  '',
  'This page (`/`) is the entry point. It carries `list_intents` and `start_shopping`:',
  '',
  '    await window.webmcp.callTool("start_shopping", {',
  '      intent: "a winter work trip to Boston — I need boots and a clutch"',
  '    })',
  '',
  'That NAVIGATES to the storefront, which registers its own tools',
  '(`send_message`, `get_products`, `add_to_cart`, …) and submits the opening intent',
  'automatically, so the first layout composes with no further call — allow 10-20',
  'seconds. Re-run discovery on the new document, read the reply with',
  '`get_messages`, then refine with `send_message`.',
  '',
  '`/instrumented` serves the same space embedded here instead, with a panel that',
  'logs every tool call as it lands.',
  '',
  '## The guide',
  '',
  win.PlaygroundAmsGuide.toText(),
  '',
  '---',
  '',
  'Generated from assets/ams-guide.js by scripts/gen-llms-txt.mjs — do not edit by hand.',
  ''
].join('\n');

await writeFile(OUT_PATH, body, 'utf8');
console.log(`wrote llms.txt (${body.length} bytes, ${body.split('\n').length} lines)`);
