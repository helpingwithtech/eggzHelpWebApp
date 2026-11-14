/**
 * Per Google's robots.txt spec the rules apply to the host they were fetched
 * from, so a single eggz.ai/robots.txt governs all eggz.ai paths (apex,
 * /help/*, etc.). app.eggz.ai is the authenticated dashboard and does not
 * require its own robots.txt — Google treats a 404 there as "fully allowed",
 * but the routes are auth-walled so nothing gets indexed regardless.
 * 
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
 * Content signals (https://contentsignals.org/) state what the content may be
 * used for once it has been fetched. They sit inside the `User-agent: *` group,
 * so they apply to every crawler the group lets in:
 *   - search=yes    building a search index and linking to the pages;
 *   - ai-input=yes  feeding a page into an AI answer at the moment it is asked;
 *   - ai-train=yes  training or fine-tuning a model.
 * All three are yes because that is what the file already allowed: nothing
 * here blocks a training crawler such as GPTBot or ClaudeBot. Saying so out loud
 * changes no crawler's access. Turning ai-train to no is a decision for Alex,
 * and would be one edit to the line below.
 *
 * Edit this file ONLY. Deploy the worker to roll out changes.
 *
 * https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec
 */
export const ROBOTS_TXT = `# Robots.txt file for https://eggz.ai
# Single source of truth: cloudflare/src/robots-content.ts in the eggzHelpWebApp repo
# Served at https://eggz.ai/robots.txt and https://eggz.ai/help/robots.txt
# All web crawlers may spider the domain.

Sitemap: https://eggz.ai/sitemap.xml
Sitemap: https://eggz.ai/help/sitemap.xml

# Content signals: what the content may be used for once it is fetched.
# search=yes lets it be indexed for search. ai-input=yes lets it be used in
# an AI answer. ai-train=yes lets it be used to train a model.
# See https://contentsignals.org/
User-agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=yes
Allow: /

# Cloudflare and Mintlify infrastructure paths — no user content
Disallow: /cdn-cgi/
Disallow: /_next/
Allow: /_next/image
`;
