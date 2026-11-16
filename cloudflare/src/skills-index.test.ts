import assert from "node:assert/strict";
import test from "node:test";

import {
  completeDescription,
  frontmatterDescription,
  isSkillsIndexPath,
  repairSkillsIndex,
  skillFileUrl,
} from "./skills-index.ts";
import { ROBOTS_TXT } from "./robots-content.ts";

// The frontmatter Mintlify generated for the help centre, as served on
// 14 Nov 2026. Its description wraps, and the index kept only line one.
const LIVE_SKILL = `---
name: eggz
description: Use eggz when managing business expenses, receipts, and invoices;
  syncing accounting data with Xero; capturing bills from web pages; organizing
  browser tabs by project; or asking an AI assistant about financial records.
metadata:
  mintlify-proj: eggz
  version: "1.0"
---

# eggz Skill Reference
`;

const FULL =
  "Use eggz when managing business expenses, receipts, and invoices; " +
  "syncing accounting data with Xero; capturing bills from web pages; organizing " +
  "browser tabs by project; or asking an AI assistant about financial records.";

const CUT = "Use eggz when managing business expenses, receipts, and invoices;";

const MINTLIFY = "https://eggz.mintlify.app";

test("frontmatterDescription folds a wrapped plain description into one line", () => {
  assert.equal(frontmatterDescription(LIVE_SKILL), FULL);
});

test("frontmatterDescription reads quoted and block descriptions", () => {
  assert.equal(
    frontmatterDescription(`---\nname: a\ndescription: "One line: quoted"\n---\n`),
    "One line: quoted",
  );
  assert.equal(
    frontmatterDescription(`---\ndescription: 'it''s\n  wrapped'\nname: a\n---\n`),
    "it's wrapped",
  );
  assert.equal(
    frontmatterDescription(`---\ndescription: >-\n  folded across\n  two lines\nname: a\n---\n`),
    "folded across two lines",
  );
  assert.equal(
    frontmatterDescription(`---\ndescription: >2-\n  indent first\n  then chomp\n---\n`),
    "indent first then chomp",
  );
  assert.equal(
    frontmatterDescription(`---\ndescription: |\n  kept\n  apart\n---\n`),
    "kept\napart",
  );
});

test("frontmatterDescription is null without frontmatter or a description", () => {
  assert.equal(frontmatterDescription("# no frontmatter"), null);
  assert.equal(frontmatterDescription("---\nname: a\n---\n"), null);
  assert.equal(frontmatterDescription("---\nname: a\n"), null);
});

test("completeDescription only lengthens a cut-off description", () => {
  assert.equal(completeDescription(CUT, FULL), FULL);
  assert.equal(completeDescription(FULL, FULL), FULL);
  assert.equal(completeDescription("Something else entirely.", FULL), "Something else entirely.");
  assert.equal(completeDescription(CUT, null), CUT);
  assert.equal(completeDescription("", FULL), "");
});

test("skillFileUrl finds the file for both index shapes and stays on the index host", () => {
  const current = new URL(`${MINTLIFY}/.well-known/agent-skills/index.json`);
  const legacy = new URL(`${MINTLIFY}/.well-known/skills/index.json`);
  assert.equal(
    skillFileUrl({ url: "/.well-known/agent-skills/eggz/skill.md" }, current)?.href,
    `${MINTLIFY}/.well-known/agent-skills/eggz/skill.md`,
  );
  assert.equal(
    skillFileUrl({ name: "eggz", files: ["SKILL.md"] }, legacy)?.href,
    `${MINTLIFY}/.well-known/skills/eggz/SKILL.md`,
  );
  assert.equal(skillFileUrl({ url: "https://elsewhere.example/skill.md" }, current), null);
  assert.equal(skillFileUrl({ name: "../x", files: ["SKILL.md"] }, legacy), null);
  assert.equal(skillFileUrl({ name: "eggz", files: ["README.md"] }, legacy), null);
});

test("repairSkillsIndex puts the whole description back in the current index", async () => {
  const index = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "eggz",
        type: "skill-md",
        description: CUT,
        url: "/.well-known/agent-skills/eggz/skill.md",
        digest: "sha256:abc",
      },
    ],
  };
  const asked: string[] = [];
  const out = await repairSkillsIndex(
    JSON.stringify(index),
    new URL(`${MINTLIFY}/.well-known/agent-skills/index.json`),
    async (url) => {
      asked.push(url.href);
      return LIVE_SKILL;
    },
  );
  assert.ok(out);
  const parsed = JSON.parse(out ?? "{}");
  assert.equal(parsed.skills[0].description, FULL);
  // Everything else, digest included, is exactly as it came.
  assert.equal(parsed.$schema, index.$schema);
  assert.equal(parsed.skills[0].digest, "sha256:abc");
  assert.equal(parsed.skills[0].url, index.skills[0]!.url);
  assert.deepEqual(asked, [`${MINTLIFY}/.well-known/agent-skills/eggz/skill.md`]);
});

test("repairSkillsIndex repairs the legacy index too", async () => {
  const out = await repairSkillsIndex(
    JSON.stringify({ skills: [{ name: "eggz", description: CUT, files: ["SKILL.md"] }] }),
    new URL(`${MINTLIFY}/.well-known/skills/index.json`),
    async () => LIVE_SKILL,
  );
  assert.equal(JSON.parse(out ?? "{}").skills[0].description, FULL);
});

test("repairSkillsIndex leaves the upstream bytes alone when nothing is cut off", async () => {
  const whole = JSON.stringify({ skills: [{ name: "eggz", description: FULL, files: ["SKILL.md"] }] });
  const indexUrl = new URL(`${MINTLIFY}/.well-known/skills/index.json`);
  assert.equal(await repairSkillsIndex(whole, indexUrl, async () => LIVE_SKILL), null);
  // An unreadable skill file keeps the description the index came with.
  const cut = JSON.stringify({ skills: [{ name: "eggz", description: CUT, files: ["SKILL.md"] }] });
  assert.equal(await repairSkillsIndex(cut, indexUrl, async () => null), null);
  assert.equal(await repairSkillsIndex("not json", indexUrl, async () => LIVE_SKILL), null);
  assert.equal(await repairSkillsIndex('{"nope":1}', indexUrl, async () => LIVE_SKILL), null);
});

test("both index paths are recognised, nothing else is", () => {
  assert.ok(isSkillsIndexPath("/.well-known/agent-skills/index.json"));
  assert.ok(isSkillsIndexPath("/.well-known/skills/index.json"));
  assert.ok(!isSkillsIndexPath("/.well-known/agent-skills/eggz/skill.md"));
  assert.ok(!isSkillsIndexPath("/help/index.json"));
});

test("robots.txt declares content signals inside the User-agent: * group", () => {
  const lines = ROBOTS_TXT.split("\n");
  const group = lines.indexOf("User-agent: *");
  assert.notEqual(group, -1);
  const signal = lines.indexOf("Content-Signal: search=yes, ai-input=yes, ai-train=yes");
  assert.ok(signal > group, "Content-Signal sits after User-agent: *");
  // No blank line between them, or a parser reads the signal as outside the group.
  assert.ok(lines.slice(group, signal).every((line) => line.trim() !== ""));
});
