# CLAUDE.md

This file provides agent-specific guidance for Claude Code and the GitHub Copilot CLI.

For project conventions, architecture, and commands, see [`.github/copilot-instructions.md`](.github/copilot-instructions.md).

## Sub-Agents

Seven slash commands invoke specialized sub-agents for this project. All agents operate in **draft & propose** mode — they research and plan before writing anything. No files are written until you confirm.

| Command | When to Use |
|---------|-------------|
| `/nimble-scaffold` | Adding a new Svelte sheet (actor or item). Generates all 4 artifacts: sheet class, Svelte component, props type, SCSS partial. |
| `/nimble-macro` | Authoring or updating a macro JSON in `packs/macros/core/`. Cross-references hand-written scripts in `~/foundryVTT/scripts/`. |
| `/nimble-research` | Answering an implementation question. Searches the codebase + fetches up-to-date docs via Context7 MCP. Read-only. |
| `/nimble-review` | Reviewing changed/staged files against CLAUDE.md conventions before committing. |
| `/nimble-upstream` | Comparing fork against `upstream/dev`, categorizing changes, and drafting patches. No git operations beyond `fetch`. |
| `/nimble-git-ops` | Full deliberate Git workflow: survey → code review (`nimble-review`) → `pnpm check` → grouped commits (confirmed) → push → PR/issue management. Use when you want a thorough, interactive commit cycle. |
| `/nimble-commit-push` | Quick automated pipeline: auto-group changes → `pnpm check` → commit all groups → push → open PR to `stage`. Use when code is ready and you want zero friction. |

### When to Auto-Invoke

- **New sheet needed** → run `/nimble-scaffold SheetName Actor character` before writing any code.
- **New macro needed** → run `/nimble-macro "Macro Name"` to draft the JSON.
- **Unsure how to implement something** → run `/nimble-research <question>` first.
- **Before committing** → run `/nimble-review` to catch convention violations.
- **Upstream has new commits** → run `/nimble-upstream` to plan the merge safely.
- **Ready to commit with full review** → run `/nimble-git-ops` for the complete quality-gated workflow.
- **Just commit and push quickly** → run `/nimble-commit-push` for automated grouping + PR.

## Agent Memory

After completing any feature, bug fix, or architectural discovery, update:
`.claude/memory/MEMORY.md`

Include: patterns confirmed, key file locations, bug fixes and their root causes, gotchas.
Keep entries concise. Update or remove stale entries rather than appending duplicates.
