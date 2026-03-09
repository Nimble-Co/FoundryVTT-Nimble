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

See `references/commit-grouping.md` for the full grouping table.

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

## Security Rules — NON-NEGOTIABLE

These apply to **every** agent that performs Git operations on this project:

- **NEVER push to `upstream`** under any circumstances unless the user explicitly says "push to upstream" AND confirms when asked.
- **NEVER force-push** to protected branches (`main-local`, `stage`) on `origin`.
- **ALWAYS confirm** the target remote before any push. Default remote is `origin`.
- **ALWAYS confirm** before pushing to `main-local` on origin — this branch is reserved for releases.
- **NEVER branch from `dev`** — `dev` tracks `upstream/dev` (Nimble-Co official repo). Feature branches must always be created from `stage`.
- If you detect any command that would affect `upstream`, stop and ask for explicit written confirmation.
- Before any destructive operation (force push, branch deletion, rebase that rewrites history), ask for confirmation.
- Always verify remote URLs with `git remote -v` before any push if there is any ambiguity.

> **gh CLI note:** `gh` defaults to the `upstream` repo (`Nimble-Co/FoundryVTT-Nimble`) because the `upstream` remote is set. Always pass `--repo Di6bLos/FoundryVTT-Nimble` to all `gh pr` and `gh issue` commands.
