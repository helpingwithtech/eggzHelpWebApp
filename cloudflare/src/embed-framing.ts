/**
 * Allow the eggz web app to embed https://eggz.ai/help in an iframe (Help Centre sheet).
 *
 * Mintlify upstream sends `X-Frame-Options: DENY` and a restrictive
 * `frame-ancestors` CSP. The reverse proxy rewrites those headers per
 * OWASP clickjacking guidance: prefer CSP frame-ancestors, remove legacy XFO.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors
 */

/**
 * Origins permitted to frame proxied help content (in-app Help Centre).
 * `https://*.vercel.app` is intentional: eggzWebApp preview deployments use
 * per-branch `*.vercel.app` hostnames (no single stable preview origin).
 */
export const IN_APP_FRAME_ANCESTORS = [
  "'self'",
  "https://app.eggz.ai",
  "https://staging.app.eggz.ai",
  "https://preview.app.eggz.ai",
  "https://*.vercel.app",
  "http://localhost:3000",
] as const;

export const FRAME_ANCESTORS_DIRECTIVE = `frame-ancestors ${IN_APP_FRAME_ANCESTORS.join(" ")}`;

const FRAME_ANCESTORS_RE = /frame-ancestors\s+[^;]*/i;

/**
 * Replace or append the `frame-ancestors` clause in a full Mintlify CSP string.
 */
export function rewriteCspForInAppEmbed(csp: string): string {
  if (FRAME_ANCESTORS_RE.test(csp)) {
    return csp.replace(FRAME_ANCESTORS_RE, FRAME_ANCESTORS_DIRECTIVE);
  }
  const trimmed = csp.trimEnd();
  const separator = trimmed.endsWith(";") ? " " : "; ";
  return `${trimmed}${separator}${FRAME_ANCESTORS_DIRECTIVE}`;
}

/**
 * Strip blocking X-Frame-Options and widen frame-ancestors for eggz app embeds.
 * Call on every proxied response before returning to the client.
 */
export function applyInAppEmbedHeaders(headers: Headers): void {
  headers.delete("X-Frame-Options");

  const csp = headers.get("Content-Security-Policy");
  if (csp) {
    headers.set("Content-Security-Policy", rewriteCspForInAppEmbed(csp));
    return;
  }

  headers.set("Content-Security-Policy", FRAME_ANCESTORS_DIRECTIVE);
}
