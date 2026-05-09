/**
 * help.eggz.ai/* → eggz.ai/help/*  (HTTP 301, path-preserving)
 *
 * Why 301 (not 302): permanent redirect tells Google to transfer link equity
 * to the new URL. Path is preserved one-to-one so individual indexed pages
 * continue ranking under their corresponding new URL, not flattened to home.
 *
 * Special handling:
 *   - /.well-known/acme-challenge/* is not redirected (let TLS issuance work).
 *   - HEAD requests get 301 too so crawlers can re-discover quickly.
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/.well-known/acme-challenge/")) {
      return new Response("Not Found", { status: 404 });
    }

    // Map "/" → "/help", "/foo" → "/help/foo".
    const newPath =
      url.pathname === "/" || url.pathname === ""
        ? "/help"
        : `/help${url.pathname.startsWith("/") ? "" : "/"}${url.pathname}`;

    const target = `https://eggz.ai${newPath}${url.search}${url.hash}`;

    return new Response(null, {
      status: 301,
      headers: {
        Location: target,
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
