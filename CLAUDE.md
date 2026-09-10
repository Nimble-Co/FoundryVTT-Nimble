Read and follow all instructions in AGENTS.md

## Behavior Guidelines

1. **Build on prior work.** This is an ongoing project. Review what's already been planned or built before suggesting new features. Check memory files and any tracking documents before starting fresh.
2. **Be thorough and accurate.** When compiling data from the rulebooks (spells, classes, weapons, ancestries, etc.), pull directly from the source material.
3. **Don't substitute 5e rules.** When a rule isn't covered in the uploaded materials, say so rather than guessing. Never silently substitute D&D 5e rules or mechanics.
4. **Plan before building.** When scoping new work, identify what mechanics need tracking, what choices players/GMs make, and what information needs surfacing — then implement.
5. **Ask clarifying questions** about the current state of the project when needed rather than assuming what has or hasn't been addressed.
6. **Relevant code comments.** Don't add comments to code if it doesn't add value, fixing a bug doesn't mean you need to explain the fix in the code comment, writing a new function doesn't mean you need to explain every line in that function. Code speaks for itself, unless the code is complex in a way that would benefit from a comment. If you add comments they should be **short and to the point.** 
7. **Automate bookkeeping, not decisions.**, The Foundry system should remove tedious work, enforce genuinely unambiguous rules, and handle complex mechanical interactions, while always preserving meaningful player and GM choices. Never automate something merely because it is possible to automate. Nimble should feel like a TTRPG being facilitated by software, not a video game where the software plays the rules for you.
**When a choice belongs to the player or GM, surface it. When something is tedious or unambiguous, automate it.**


## Specialist agents

`.claude/agents/` holds subagents for this repo. Route a task by what it is about:

1. What the game rules say (mechanics, rules accuracy, rulebook lookups): **nimble-rules-agent**
2. How Foundry works (document classes, DataModels, hooks, sheets API, active effects): **foundry-agent**
3. The rules engine code (rule types in `src/models/rules/`): **rules-engine-agent**
4. UI work (Svelte components, sheets, dialogs, chat cards): **ui-agent**
5. Pack content (JSON in `packs/`): **content-pack-agent**
6. Tests, migrations, type checks, linting: **quality-agent**

The nimble-rules-agent says what the game should do. The rules-engine-agent implements it. The rulebooks are local files in `_bmad-output/rules/` and are not in the repository.

## User-facing docs

When a change alters what a player, GM or homebrewer sees, update `docs/documentation/` on the same branch. Never edit `docs/documentation/reference/*.md` by hand: `pnpm docs:generate` builds it from the rule schemas, settings, conditions and `public/lang/en.json`.
