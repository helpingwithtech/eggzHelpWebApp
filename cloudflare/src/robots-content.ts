/**
 * Canonical robots.txt — single source of truth for the entire eggz domain.
 *
 * Served verbatim at:
 *   - https://eggz.ai/robots.txt        (canonical URL, 200)
 *   - https://eggz.ai/help/robots.txt   (mirror, 200)
 *
 * Layout follows the Salesforce / large-SaaS convention: file header, all
 * `Sitemap:` directives grouped at the top, then `User-agent` rules. Per
 * Google's spec the `sitemap` field is global (not tied to any user-agent),
 * so the order makes no functional difference but the top-grouping is the
 * widely-followed industry pattern (cf. https://www.salesforce.com/robots.txt).
 *
 * Edit this file ONLY. Deploy the worker to roll out changes.
 *
 * https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
 */
export const ROBOTS_TXT = `# Robots.txt file for https://eggz.ai
# Single source of truth: help-eggz-ai/cloudflare/src/robots-content.ts
# Served at https://eggz.ai/robots.txt and https://eggz.ai/help/robots.txt
# All web crawlers may spider the domain.

Sitemap: https://eggz.ai/sitemap.xml
Sitemap: https://eggz.ai/help/sitemap.xml

User-agent: *
Allow: /

# Cloudflare and Mintlify infrastructure paths — no user content
Disallow: /cdn-cgi/
Disallow: /_next/
Allow: /_next/image
`;
