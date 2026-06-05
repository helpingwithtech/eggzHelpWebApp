# Agent Instructions — eggz Help Centre

Mintlify docs for **eggz.ai** (`https://eggz.ai/help`). This repo is a **consumer** of eggzWebApp product and brand canon.

## Context routing

- [`CONTEXT.md`](CONTEXT.md) · [`docs/CONTEXT.md`](docs/CONTEXT.md)
- Alignment (read first for public copy): [`docs/internal/alignment-register-stub.md`](docs/internal/alignment-register-stub.md)
- Finishing work / post-change steps (single source, web app): `receipt-tracker-master/docs/workspaces/cross-project/docs/ship-checklist.md`

## Rules

1. **Web app wins** on behaviour, billing limits, and onboarding steps.
2. Add drift rows to the canonical register in `receipt-tracker-master` — do not invent limits or step counts.
3. User-visible fixes → `<Update>` in [`help/changelog.mdx`](help/changelog.mdx).
4. After MDX edits: `mint broken-links` (see `.github/workflows/validate-docs.yml`).

## Brand

`docs.json` and `help/style.css` follow `receipt-tracker-master/lib/brand-tokens.ts` — see web app `docs/workspaces/cross-project/docs/brand-sync.md`.

## Git

Never commit to `main`; use feature branches. Do not maintain a separate engineering roadmap here — use web app `cross-project-changelog.md` for engineering history.
