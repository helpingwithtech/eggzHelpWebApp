---
name: Draft docs for new features
on:
  push:
    - repo: helpingwithtech/receipt-tracker-saas
      branch: main
context:
  - repo: helpingwithtech/docs
automerge: false
---

When the eggz web app ships user-facing changes on `main`, review the diff against `help/guides/*.mdx` and `help/unscrambled-tabs/*.mdx`. Open a PR in this docs repo for gaps. Cross-check `receipt-tracker-master/docs/workspaces/cross-project/docs/consumer-manifest.md` for required pages.

Do not invent billing limits — use `autumn.config.ts` in the web app repo as canon.
