import assert from "node:assert/strict";
import test from "node:test";

import {
  FRAME_ANCESTORS_DIRECTIVE,
  applyInAppEmbedHeaders,
  rewriteCspForInAppEmbed,
} from "./embed-framing.ts";

test("rewriteCspForInAppEmbed replaces Mintlify frame-ancestors", () => {
  const upstream =
    "worker-src * blob: data:; frame-ancestors 'self' https://dashboard.mintlify.com; form-action 'self'";
  const out = rewriteCspForInAppEmbed(upstream);
  assert.match(out, /frame-ancestors 'self' https:\/\/eggz\.ai https:\/\/app\.eggz\.ai/);
  assert.match(out, /https:\/\/\*\.vercel\.app/);
  assert.match(out, /http:\/\/localhost:3000/);
  assert.doesNotMatch(out, /dashboard\.mintlify\.com/);
});

test("rewriteCspForInAppEmbed appends when frame-ancestors is absent", () => {
  const upstream = "default-src 'self'; script-src 'self'";
  const out = rewriteCspForInAppEmbed(upstream);
  assert.ok(out.endsWith(FRAME_ANCESTORS_DIRECTIVE));
});

test("applyInAppEmbedHeaders removes X-Frame-Options and sets CSP", () => {
  const headers = new Headers({
    "X-Frame-Options": "DENY",
    "Content-Security-Policy":
      "frame-ancestors 'self' https://app.mintlify.com; default-src 'self'",
  });
  applyInAppEmbedHeaders(headers);
  assert.equal(headers.get("X-Frame-Options"), null);
  assert.match(headers.get("Content-Security-Policy") ?? "", /https:\/\/app\.eggz\.ai/);
});
