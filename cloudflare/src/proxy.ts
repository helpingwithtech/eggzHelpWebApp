/**
 * eggz.ai/help/* — reverse proxy to Mintlify (custom subpath).
 *
 * Per Mintlify "Custom subpath" docs:
 *   - target origin = <subdomain>.mintlify.app
 *   - send Origin / X-Forwarded-{For,Proto} / X-Real-IP / User-Agent
 *   - DO NOT forward Host
 *   - cache ONLY /mintlify-assets/_next/static/*
 *
 * SEO note (HTMLRewriter):
 *   Mintlify generates HTML referencing its own origin (eggz.mintlify.app) in
 *   <link rel="canonical">, <meta property="og:url">, hreflang, and sitemap
 *   anchor URLs. We rewrite those to https://eggz.ai/help/... so Google indexes
 *   the eggz.ai apex, not the mintlify.app preview origin. We do NOT touch
 *   relative URLs or third-party absolute URLs.
 */

interface Env {
  MINTLIFY_ORIGIN: string;
}

const PUBLIC_ORIGIN = "https://eggz.ai";

const PROXIED_PREFIXES: readonly string[] = [
  "/help",
  "/.well-known/vercel/",
  "/.well-known/skills/",
  "/_mintlify/",
  "/mintlify-assets/_next/static/",
];

const PROXIED_EXACT: readonly string[] = ["/skill.md"];

function shouldProxy(pathname: string): boolean {
  if (PROXIED_EXACT.includes(pathname)) return true;
  return PROXIED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p === "/help" ? "/help/" : p),
  );
}

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith("/mintlify-assets/_next/static/");
}

function isHtml(contentType: string | null): boolean {
  return !!contentType && contentType.toLowerCase().startsWith("text/html");
}

function isXmlLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.includes("xml") || ct.includes("text/plain");
}

/**
 * Rewrite an absolute URL that points at the Mintlify origin so it points at
 * eggz.ai instead. Leaves other URLs untouched.
 */
function rewriteAbsoluteUrl(value: string, mintlifyOrigin: string): string {
  const httpsOrigin = `https://${mintlifyOrigin}`;
  const httpOrigin = `http://${mintlifyOrigin}`;
  if (value.startsWith(httpsOrigin)) return PUBLIC_ORIGIN + value.slice(httpsOrigin.length);
  if (value.startsWith(httpOrigin)) return PUBLIC_ORIGIN + value.slice(httpOrigin.length);
  return value;
}

function rewriteAttribute(
  el: Element,
  attr: string,
  mintlifyOrigin: string,
): void {
  const v = el.getAttribute(attr);
  if (!v) return;
  const next = rewriteAbsoluteUrl(v, mintlifyOrigin);
  if (next !== v) el.setAttribute(attr, next);
}

class CanonicalAttrRewriter {
  constructor(
    private readonly attr: string,
    private readonly mintlifyOrigin: string,
  ) {}
  element(el: Element) {
    rewriteAttribute(el, this.attr, this.mintlifyOrigin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Defence in depth: only handle paths the route map allows.
    if (!shouldProxy(url.pathname)) {
      return new Response("Not Found", { status: 404 });
    }

    const origin = env.MINTLIFY_ORIGIN;
    const upstream = new URL(`https://${origin}${url.pathname}${url.search}`);

    // Build headers from the incoming request, but do NOT forward Host.
    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.delete("host");
    upstreamHeaders.set("Origin", `https://${origin}`);
    upstreamHeaders.set("X-Forwarded-Host", url.host);
    upstreamHeaders.set("X-Forwarded-Proto", "https");

    const clientIP = request.headers.get("CF-Connecting-IP");
    if (clientIP) {
      upstreamHeaders.set("X-Real-IP", clientIP);
      const xff = request.headers.get("X-Forwarded-For");
      upstreamHeaders.set(
        "X-Forwarded-For",
        xff ? `${xff}, ${clientIP}` : clientIP,
      );
    }

    const upstreamRequest = new Request(upstream.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? null
          : request.body,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);

    // Cache header normalisation: only cache the long-lived static asset path.
    const outHeaders = new Headers(upstreamResponse.headers);
    if (isStaticAsset(url.pathname)) {
      outHeaders.set("Cache-Control", "public, max-age=86400, immutable");
    } else {
      outHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    }

    // Rewrite Location header on redirects so the Mintlify origin is never
    // exposed to clients or crawlers.
    if (upstreamResponse.status >= 300 && upstreamResponse.status < 400) {
      const location = outHeaders.get("Location");
      if (location) {
        outHeaders.set("Location", rewriteAbsoluteUrl(location, origin));
      }
    }

    const contentType = upstreamResponse.headers.get("content-type");

    // SEO: rewrite Mintlify-origin URLs to eggz.ai in HTML responses.
    if (isHtml(contentType)) {
      const rewriter = new HTMLRewriter()
        // Canonical link, alternate hreflang links, og/twitter meta
        .on('link[rel="canonical"]', new CanonicalAttrRewriter("href", origin))
        .on('link[rel="alternate"]', new CanonicalAttrRewriter("href", origin))
        .on('meta[property="og:url"]', new CanonicalAttrRewriter("content", origin))
        .on('meta[name="twitter:url"]', new CanonicalAttrRewriter("content", origin))
        // Any absolute URL that happens to point at the Mintlify origin
        .on("a[href]", new CanonicalAttrRewriter("href", origin))
        .on("link[href]", new CanonicalAttrRewriter("href", origin))
        .on("script[src]", new CanonicalAttrRewriter("src", origin))
        .on("img[src]", new CanonicalAttrRewriter("src", origin));

      return rewriter.transform(
        new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: outHeaders,
        }),
      );
    }

    // SEO: rewrite absolute URLs in sitemap.xml / robots.txt as plain string
    // replacement (HTMLRewriter does not parse XML or text). Only safe for
    // small responses we read fully into memory.
    if (
      isXmlLike(contentType) &&
      (url.pathname.endsWith("/sitemap.xml") ||
        url.pathname.endsWith("/robots.txt") ||
        url.pathname.endsWith(".xml"))
    ) {
      const text = await upstreamResponse.text();
      const rewritten = text
        .split(`https://${origin}`)
        .join(PUBLIC_ORIGIN)
        .split(`http://${origin}`)
        .join(PUBLIC_ORIGIN);
      return new Response(rewritten, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: outHeaders,
      });
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: outHeaders,
    });
  },
};
