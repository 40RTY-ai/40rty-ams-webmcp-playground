/**
 * The WebMCP operator contract — the fixed instruction set an external agent
 * reads to behave as a well-formed WebMCP client on this page.
 *
 * The FRAMEWORK half is mirrored from the AMS client SDK, which serves the same
 * contract at runtime. It is duplicated rather than imported because this repo
 * has no build step and must not depend on the embed bundle to describe itself.
 * Keep the two in sync; see NOTICE.
 *
 * What ships to an agent, though, is the framework PLUS the AMS capability guide
 * from ams-guide.js, composed below. The framework alone tells an agent how to
 * behave and nothing about what this site can do — which is how you get an agent
 * that treats a layout-composing storefront as a search box. The guide goes
 * BEFORE the goal so the goal stays last and most recent.
 *
 * Deliberately TOOL-AGNOSTIC: it names no specific tool, so it survives
 * per-space `webmcpConfig` (tools enabled / disabled / renamed) unchanged. The
 * operator maps intent onto whatever `listTools()` reveals.
 */
(function () {
  'use strict';

  var GOAL_PLACEHOLDER = '<your request here>';

  var PROMPT = [
    'You are an operator for a WebMCP-enabled page. It exposes a tool API at window.webmcp — that registered tool surface is your ONLY interface to this page, and where the page has its own AI, you are that AI\'s mouthpiece, not an independent narrator.',
    '',
    'Execute the GOAL below NOW, end to end, in one go. Execute — do not describe.',
    '',
    'DISCOVERY IS A SILENT PREREQUISITE, NOT A REPORT:',
    '- Call window.webmcp.listTools() to learn the surface, then immediately start acting.',
    '- Do NOT list, summarize, or explain the tools. Do NOT say "Here\'s what I can do."',
    '- Do NOT ask permission or ask if I want you to proceed. Assume yes. Just run it.',
    '- Your only user-facing output is progress on the goal and the site AI\'s response — never a description of your capabilities or plan.',
    '',
    'WEBMCP OPERATING RULES:',
    '- TOOLS ONLY. Every observation and action goes through window.webmcp.callTool(name, args) (always await it). Never read or manipulate the DOM — no querySelector, no innerText, no scraping from HTML, no screenshots. The tools are ground truth; the page is not. When you need the page\'s state or contents, a tool reports it — use that.',
    '- VERIFY ONLY THROUGH TOOLS. Confirm an action worked by its return value or by re-querying the right read/status tool — never by inspecting the page.',
    '- AGENT-BACKED TOOLS RETURN THE AI\'S ANSWER. Some tools hand the request to the site\'s own AI; they await it and return its response text. Relay that text verbatim — it is the site AI speaking. Do not paraphrase it or write your own prose over it. You operate the tools; the site AI is the voice.',
    '- DISCOVER, DON\'T ASSUME. Only use capabilities discovery actually showed you. If something the goal needs isn\'t in the surface, say so and stop — don\'t improvise against the page.',
    '',
    'Work one step at a time, awaiting each call before the next. You are NOT finished until the goal is fully achieved and confirmed through tools.',
    '',
    'GOAL:',
    GOAL_PLACEHOLDER
  ].join('\n');

  /** Where the goal slot begins, so the guide can be inserted ahead of it. */
  var GOAL_MARKER = '\n\nGOAL:\n';

  /** The mirrored framework, without the trailing goal slot. */
  function framework() {
    var at = PROMPT.indexOf(GOAL_MARKER);
    return at < 0 ? PROMPT : PROMPT.slice(0, at);
  }

  /**
   * The AMS capability guide, if it loaded. Absence is tolerated rather than
   * fatal: a missing guide should degrade to the plain contract, not to no
   * instructions at all.
   */
  function guide() {
    if (!window.PlaygroundAmsGuide) {
      console.warn('[playground] AMS guide not loaded — serving the contract without it.');
      return '';
    }
    return window.PlaygroundAmsGuide.toText();
  }

  /**
   * Compose framework + AMS guide + goal. An empty goal leaves the placeholder
   * intact, so the "copy prompt" affordance still hands over something
   * paste-ready.
   */
  function build(goal) {
    var trimmed = typeof goal === 'string' ? goal.trim() : '';
    var parts = [framework()];
    var guideText = guide();
    if (guideText.length > 0) {
      parts.push('--- THE SITE YOU ARE OPERATING ---');
      parts.push(guideText);
      parts.push('--- END SITE GUIDE ---');
    }
    parts.push('GOAL:\n' + (trimmed.length === 0 ? GOAL_PLACEHOLDER : trimmed));
    return parts.join('\n\n');
  }

  window.PlaygroundOperatorPrompt = {
    /** Full instructions served to an agent: contract + AMS guide + goal slot. */
    get text() {
      return build('');
    },
    /** The mirrored contract alone, without the guide. */
    frameworkText: PROMPT,
    build: build
  };
})();
