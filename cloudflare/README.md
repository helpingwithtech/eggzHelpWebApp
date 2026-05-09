# eggz Help Centre — Cloudflare Workers

Two Workers that front the eggz Help Centre on the **`eggz.ai`** zone.

| Worker | Route(s) | Purpose |
|---|---|---|
| `eggz-help-proxy` | `eggz.ai/help`, `eggz.ai/help/*`, plus required Mintlify well-known and asset paths | Reverse proxy from `eggz.ai/help/*` to **`eggz.mintlify.app/help/*`** (Mintlify custom subpath). |
| `eggz-help-redirect` | `help.eggz.ai/*` | HTTP **301** to `eggz.ai/help/<path>` so SEO link equity migrates per URL. |

> Mintlify origin = `eggz.mintlify.app` (custom subpath uses **`.app`**, not `.dev`).
> Source: Mintlify "Custom subpath" + "Cloudflare" deploy docs.

## Prerequisites

- `pnpm install` at this folder (uses `wrangler` v4+).
- Cloudflare account with the **`eggz.ai`** zone authorised: `pnpm wrangler login`.
- The Mintlify dashboard for `eggz` configured to **add `eggz.ai` as a custom domain** with **"Host at /docs" disabled** (custom subpath).

## Common commands

```bash
# Validate both Workers without deploying
pnpm validate

# (Optional) generate worker-configuration.d.ts for type-safe binding access
pnpm types

# Local dev
pnpm dev:proxy      # default Worker
pnpm dev:redirect   # the 301 Worker

# Dry-run deploys
pnpm deploy:dry-run:proxy
pnpm deploy:dry-run:redirect

# Deploys
pnpm deploy:proxy
pnpm deploy:redirect

# Live logs
pnpm tail:proxy
pnpm tail:redirect
```

## Files

- `wrangler.jsonc` — both Workers (default + `env.redirect`); JSONC, with `compatibility_date` and `nodejs_compat`.
- `src/proxy.ts` — Mintlify reverse proxy. Sets `Origin`, `X-Forwarded-{For,Proto}`, `X-Real-IP`; **never forwards `Host`**. Caches only `/mintlify-assets/_next/static/*`. Uses **`HTMLRewriter`** to rewrite `eggz.mintlify.app` → `eggz.ai` in `<link rel="canonical">`, `<meta property="og:url">`, hreflang alternates, and absolute internal anchors so Google indexes the apex URL.
- `src/redirect.ts` — Path-preserving 301 from `help.eggz.ai/*` → `eggz.ai/help/*`.

## DNS — what NOT to change

The standard Mintlify dashboard "Add domain" flow asks you to add a CNAME `@ → cname.mintlify.builders` on `eggz.ai`. **Do not add that record.** It would route the entire apex domain to Mintlify and break the eggz web app.

This setup uses Cloudflare Worker routes instead, which intercept `/help/*` requests at the edge before DNS resolution would apply. No DNS change on `eggz.ai` is required to ship this.

If Mintlify keeps prompting to add `eggz.ai` in the dashboard, leave the project on its `eggz.mintlify.app` origin and let the Worker do canonical rewriting (already configured). The TXT records previously added for `help.eggz.ai` (e.g. `_cf-custom-hostname`, `_acme-challenge`) belong to the legacy subdomain — leave them alone for now; they can be cleaned up after Search Console finishes the change of address.

## SEO migration order (do not skip steps)

1. Push the docs branch so Mintlify rebuilds with the new `help/` structure. Verify pages at the Mintlify preview URL render under `/help/...`.
2. Deploy the **proxy** Worker (`pnpm deploy:proxy`). Verify `https://eggz.ai/help` returns 200.
3. Deploy the **redirect** Worker (`pnpm deploy:redirect`). Verify `curl -I https://help.eggz.ai/unscrambled-tabs/install` returns `HTTP/2 301` and `location: https://eggz.ai/help/unscrambled-tabs/install`.
4. Confirm canonical rewrite is live: `curl -s https://eggz.ai/help/unscrambled-tabs/install | grep canonical` should show `href="https://eggz.ai/help/unscrambled-tabs/install"`.
5. Google Search Console:
   - Add property for `eggz.ai` if not present, verify ownership.
   - Open the **`help.eggz.ai`** property → **Settings → Change of Address** → choose `eggz.ai`.
   - Submit the new sitemap (`https://eggz.ai/help/sitemap.xml`).
6. Ship the extension version with the new help URL.

## Routing safety

This Worker only claims explicit prefixes (`/help`, `/help/*`, `/.well-known/vercel/*`, `/.well-known/skills/*`, `/skill.md`, `/_mintlify/*`, `/mintlify-assets/_next/static/*`). Cloudflare matches the most specific route first, so a catch-all `eggz.ai/*` Worker that serves the marketing site continues to handle every other URL.
