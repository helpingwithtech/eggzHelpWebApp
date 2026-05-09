/**
 * Canonical robots.txt — single source of truth for the entire eggz domain.
 *
 * Served verbatim at:
 *   - https://eggz.ai/robots.txt        (canonical URL, 200)
 *   - https://eggz.ai/help/robots.txt   (mirror, 200)
 *
 * Per Google's robots.txt spec the rules apply to the host they were fetched
 * from, so a single eggz.ai/robots.txt governs all eggz.ai paths (apex,
 * /help/*, etc.). app.eggz.ai is the authenticated dashboard and does not
 * require its own robots.txt — Google treats a 404 there as "fully allowed",
 * but the routes are auth-walled so nothing gets indexed regardless.
 *
 * Edit this file ONLY. Do not duplicate the rules anywhere else.
 *
 * https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
 */
export const ROBOTS_TXT = `# Canonical robots.txt — eggz.ai
# Single source of truth: help-eggz-ai/cloudflare/src/robots-content.ts
# Served at https://eggz.ai/robots.txt and https://eggz.ai/help/robots.txt

User-agent: *
Allow: /

# Cloudflare + Help Centre / Mintlify asset paths
Disallow: /cdn-cgi/

Allow: /_next/image
Disallow: /_next/

Sitemap: https://eggz.ai/sitemap.xml
Sitemap: https://eggz.ai/help/sitemap.xml
`;
