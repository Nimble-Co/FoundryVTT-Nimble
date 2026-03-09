---
name: nimble-git-conventions
description: "Invoke when determining branch names, grouping files, or formatting commit messages. Loads branch strategy, commit grouping table, commit message format, and pre-commit checklist."
---

## Branch Strategy

- `dev` tracks `upstream/dev` — do NOT create feature branches from `dev`
- Feature branches are created from `stage`: `git checkout stage && git pull origin stage && git checkout -b feature/<name>`
- Branch naming: `feature/`, `fix/`, `chore/`, `docs/` prefixes
- All PRs target `stage`, never `main-local` (unless it's a release PR and the user explicitly instructs it)
- `main-local` is reserved for releases only

## Commit Grouping Logic

When staging commits, group files by logical concern — never commit unrelated changes together:

| Group | Files to Group Together |
|-------|------------------------|
| New Svelte sheet | Sheet class (`.svelte.ts`), Svelte component (`.svelte`), props type (`types/components/`), SCSS partial (`_*.scss`) |
| Document/model change | Document class, data model, related type definitions |
| Hook changes | Hook files in `src/hooks/` |
| Utility changes | Utility files + their test files (`*.test.ts`) |
| Config/constants | `src/config.ts` + any files that reference the new constants |
| Compendium content | JSON files in `packs/` |
| Build/tooling | `vite.config.mts`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `svelte.config.js` |

Always check `git status` and `git diff --staged` before finalizing a commit. Propose your grouping plan to the user before staging if the changeset is large or ambiguous.

## Commit Message Format

```
<type>(<scope>): <short imperative description>

[optional body explaining what and why]

[optional footer: closes #issue, breaking changes, etc.]
```

Types: `FEAT`, `FIX`, `REFACTOR`, `STYLE`, `TEST`, `DOCS`, `CHORE`, `BUILD`
Scopes: `actor`, `item`, `dice`, `ui`, `hooks`, `models`, `utils`, `compendia`, `build`, `types`

Example: `FEAT(actor): add SoloMonsterSheet with proxy dispatch`

## Pre-Commit Checklist

Before EVERY commit:
1. Run `cd FoundryVTT-Nimble && pnpm check` (runs format, lint, circular-deps, type-check, tests)
2. If checks fail → report failures clearly, do NOT commit, ask if the user wants to fix issues first
3. If checks pass → proceed with commit
4. If the user explicitly says to skip checks, warn them of the risk and ask for confirmation before proceeding
