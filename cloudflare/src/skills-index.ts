/**
 * Agent skills discovery index for eggz.ai.
 *
 * Mintlify publishes the help centre's skill.md and lists it in a discovery
 * index at two paths: `/.well-known/agent-skills/index.json` (the current path,
 * Agent Skills Discovery v0.2.0) and `/.well-known/skills/index.json` (the
 * legacy one). The proxy forwards both, plus the skill files they point at.
 *
 * Mintlify's index copies only the FIRST LINE of the skill's frontmatter
 * `description`. The generated description wraps onto several lines, so the
 * index cut it off mid-sentence ("…receipts, and invoices;"). The skill file
 * itself is complete. `repairSkillsIndex` reads the description from the skill
 * file and puts the whole of it back in the index.
 *
 * It only ever lengthens a description the index has cut short: if the index
 * text is not the start of the skill file's description, it is left alone. So
 * once Mintlify stops cutting it off, this changes nothing. The skill file is
 * not touched, so each entry's `digest` still matches the bytes served.
 */

/** The two index paths Mintlify serves, current first. */
export const SKILLS_INDEX_PATHS: readonly string[] = [
  "/.well-known/agent-skills/index.json",
  "/.well-known/skills/index.json",
];

export function isSkillsIndexPath(pathname: string): boolean {
  return SKILLS_INDEX_PATHS.includes(pathname);
}

type IndexEntry = {
  name?: unknown;
  description?: unknown;
  /** v0.2.0: where the skill file is, relative to the site root or absolute. */
  url?: unknown;
  /** Legacy: files in the skill's own folder beside the index. */
  files?: unknown;
};

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      const inner = v.slice(1, -1);
      return first === "'" ? inner.replace(/''/g, "'") : inner.replace(/\\"/g, '"');
    }
  }
  return v;
}

/**
 * The `description` from a SKILL.md's YAML frontmatter, with a value that wraps
 * over several lines folded back into one, the way YAML reads it. Handles plain
 * and quoted scalars and `>` / `|` block scalars, which is everything a skill
 * description is written as. Null when there is no frontmatter or no
 * description in it.
 */
export function frontmatterDescription(markdown: string): string | null {
  const text = markdown.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end === -1) return null;
  const lines = text.slice(4, end).split("\n");

  const start = lines.findIndex((line) => /^description:/.test(line));
  if (start === -1) return null;

  const head = (lines[start] ?? "").slice("description:".length).trim();
  const continuation: string[] = [];
  for (const line of lines.slice(start + 1)) {
    // The value goes on for as long as the lines are indented (or blank).
    if (line.trim() !== "" && !/^\s/.test(line)) break;
    continuation.push(line);
  }
  while (continuation.length > 0 && continuation[continuation.length - 1]?.trim() === "") {
    continuation.pop();
  }

  const block = /^([>|])[+-]?\d?$/.exec(head);
  if (block) {
    const body = continuation.map((line) => line.trim());
    if (block[1] === "|") return body.join("\n").trim() || null;
    // `>` folds each paragraph onto one line; a blank line ends a paragraph.
    const paragraphs = body
      .join("\n")
      .split(/\n{2,}/)
      .map((p) => p.split("\n").join(" ").trim())
      .filter((p) => p !== "");
    return paragraphs.join("\n") || null;
  }

  const folded = [head, ...continuation.map((line) => line.trim())]
    .filter((part) => part !== "")
    .join(" ");
  const value = unquote(folded);
  return value === "" ? null : value;
}

/**
 * The full description when `indexed` is the start of it, else `indexed`
 * unchanged. Lengthens a cut-off description; never rewrites a different one.
 */
export function completeDescription(indexed: string, full: string | null): string {
  if (!full) return indexed;
  const prefix = indexed.trimEnd();
  if (prefix === "" || full === indexed) return indexed;
  return full.startsWith(prefix) && full.length > prefix.length ? full : indexed;
}

/**
 * Where an index entry's skill file lives, resolved against the index's own
 * URL. Only same-host locations are returned, so the proxy never fetches an
 * address the index names on some other host.
 */
export function skillFileUrl(entry: IndexEntry, indexUrl: URL): URL | null {
  let candidate: URL | null = null;
  try {
    if (typeof entry.url === "string" && entry.url !== "") {
      candidate = new URL(entry.url, indexUrl);
    } else if (
      typeof entry.name === "string" &&
      /^[a-z0-9][a-z0-9-]*$/.test(entry.name) &&
      Array.isArray(entry.files)
    ) {
      const file = entry.files.find(
        (f): f is string => typeof f === "string" && f.toLowerCase() === "skill.md",
      );
      if (file) candidate = new URL(`${entry.name}/${file}`, indexUrl);
    }
  } catch {
    return null;
  }
  if (!candidate || candidate.host !== indexUrl.host) return null;
  return candidate;
}

/**
 * Re-serialised index with every cut-off description made whole, or null when
 * nothing needed changing (or the body is not an index), in which case the
 * caller serves the upstream bytes as they came.
 *
 * `readSkill` fetches one skill file and returns its text, or null on failure;
 * a skill whose file cannot be read keeps the description it had.
 */
export async function repairSkillsIndex(
  body: string,
  indexUrl: URL,
  readSkill: (url: URL) => Promise<string | null>,
): Promise<string | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const skills = (parsed as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return null;

  let changed = false;
  for (const entry of skills as IndexEntry[]) {
    if (!entry || typeof entry !== "object" || typeof entry.description !== "string") continue;
    const url = skillFileUrl(entry, indexUrl);
    if (!url) continue;
    const text = await readSkill(url);
    if (text === null) continue;
    const next = completeDescription(entry.description, frontmatterDescription(text));
    if (next !== entry.description) {
      entry.description = next;
      changed = true;
    }
  }
  return changed ? JSON.stringify(parsed) : null;
}
