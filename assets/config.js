/**
 * Deployment configuration — the only file you should need to edit to point
 * this playground at a different AMS deployment.
 *
 * `apiBaseUrl` is the AMS API this client talks to. It serves the space
 * configuration, the session channel that carries the composing AI, and the
 * embed bundle itself. A `?api=` query override takes precedence at runtime so
 * a staging or cold-machine check can retarget without a redeploy.
 *
 * Note that the origin you serve this playground from must be accepted by that
 * API — see "Deploying" in the README. Nothing here is a secret: this client
 * holds no credentials, and the endpoint is visible to anyone who opens the
 * network tab.
 *
 * CLASSIC SCRIPT — see the ordering note in brands.js.
 */
window.PLAYGROUND_CONFIG = {
  apiBaseUrl: 'https://40rty-ams-production.up.railway.app',

  /**
   * The deployed AMS storefront the home screen hands off to.
   *
   * This is the full platform render — brand shell, navigation, hero, the
   * composer and its follow-up chips — rather than the chrome-less embed, and
   * it registers the space's WebMCP tools on its own document.
   *
   * `intentParam` is the query parameter that carries an opening prompt. AMS
   * auto-submits it on a new session (it fills the composer visibly, then
   * sends), which is what makes a one-click intent compose a storefront with
   * nothing typed. It is stripped from the address bar once read.
   */
  storefrontUrl: 'https://app.40rty.ai/stevemadden',
  intentParam: 'intent',
  /**
   * Hard ceiling on the opening prompt, in characters.
   *
   * 1000. This was 200 for a while: the value used to be validated by a schema
   * carrying a 200-char bound with the 1000 chained onto it, so both applied and
   * the smaller won — the documented limit was five times the real one. Fixed
   * upstream, and re-measured: 600 characters submits, 1050 is refused.
   *
   * Still enforced here rather than trusted, because an over-long intent is
   * DROPPED, not truncated, and dropped silently — the storefront opens with
   * nothing submitted, which reads as a broken product rather than a rejected
   * input.
   */
  intentMaxChars: 1000
};
