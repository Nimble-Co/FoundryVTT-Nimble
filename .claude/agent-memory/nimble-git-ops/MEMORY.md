# nimble-git-ops Agent Memory

## Branch Discipline (CRITICAL)
- ALWAYS cut a feature branch BEFORE making any file edits — never edit on `stage` directly.
- Command: `git checkout stage && git pull origin stage && git checkout -b feature/<name>`
- Unstaged/untracked changes carry over when you switch branches, but this should never be relied on as a recovery step.

## Branch Strategy
- Feature branches base: `stage`
- PRs target: `stage`
- `main-local` is releases only — never target for feature PRs
- `dev` tracks `upstream/dev` — never branch from it

## Pre-Commit
- Always run `pnpm check` from `/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/` before committing.
- Biome lint infos (e.g., `useParseIntRadix`) in `src/hooks/atkInit.ts` are pre-existing and do not block commits.

## Key Paths
- Project root: `/Users/carlosprieto/foundryVTT/FoundryVTT-Nimble/`
- Deploy script: `scripts/deploy-log.sh`
- Deploy log (local-only, gitignored): `logs/deploy.log`
- Build scripts: `build/`
- pnpm scripts: all run from project root

## GitHub CLI (gh) — IMPORTANT
- `gh` defaults to `upstream` repo (`Nimble-Co/FoundryVTT-Nimble`) because `upstream` remote is set.
- ALWAYS pass `--repo Di6bLos/FoundryVTT-Nimble` to all `gh pr` and `gh issue` commands.
- Without `--repo`, `gh pr create` will fail with "Head sha can't be blank" / "No commits between" errors.

## Deploy Logging
- `deploy:nimble` is wrapped by `scripts/deploy-log.sh` which appends tab-separated entries to `logs/deploy.log`
- Log format: `TIMESTAMP\tLABEL\tSTATUS\tDURATION`
- `logs/deploy.log` is gitignored; `logs/.gitkeep` tracks the directory
