---
title: Contributing
---

# Contributing

<!--@include: ../CONTRIBUTING.md-->

## Working on this documentation site

The site is built with VitePress from the `docs/` folder. To preview locally:

1. From the repo root, run `pnpm install`, then `pnpm docs:generate`. This builds the reference pages (rules, settings, conditions) from the system source. They are not checked in; without this step those pages 404.
2. `cd docs && pnpm install && pnpm dev`.

The pages under `docs/documentation/reference/` are regenerated on every deploy. Edit the generator (`scripts/docs/generateReference.gen.ts`), the source schemas, or the `_partials/` examples instead of the output. Everything else is hand-written markdown.

House style for the user documentation: plain language a GM can follow, no developer jargon, and no em-dashes anywhere (the generator strips them from generated pages automatically).
