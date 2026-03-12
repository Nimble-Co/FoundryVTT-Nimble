# Nimble 2 — Product Requirements Document

## Instructions for Ralph
- Read this file and `progress.txt` at the start of each iteration.
- Pick the first unchecked task. Cut a new branch from `stage` (follow branch name standards).
- Implement the task.
- Run `/nimble-review` on all changed files.
- Run `/nimble-e2e-tester` to validate the change end-to-end.
- Fix any issues found by review or e2e tests.
- **DO NOT COMMIT.** Leave all changes staged/unstaged for the user to review each file.
- Update `progress.txt` describing what was done and which files changed.
- Mark the task `[x]` in this file when done.
- **Task ordering standard:** Audit and cleanup tasks (duplicate features, dead code, upstream overlap) always go at the top of the task list, before bugs and new features. When adding new tasks, place audits first.

## Tasks

### Module Compatibility Audit
> Ordered simplest → most complex. **Before starting any task here, create a separate git worktree:**
> ```bash
> git worktree add ~/foundryVTT/nimble-module-audit -b audit/module-compat
> cd ~/foundryVTT/nimble-module-audit
> ```
> Do all audit and fix work inside that worktree. Branch from `stage`. DO NOT COMMIT. Run `/nimble-review` + `/nimble-e2e-tester`. Leave staged for user review.

#### Simple — Smoke Tests (no code changes expected)

- [x] **[Audit] SmallTime on v13** — Enable `smalltime`. Confirm the time widget renders, the clock updates, and there are no console errors. No code changes expected. Update `progress.txt` with pass/fail.

- [x] **[Audit] Michael Ghelfi audio pack on v13** — Enable `michaelghelfi`. Open the Playlists tab and confirm ambient tracks are visible and playable. This is an asset-only module; no JS hooks. Update `progress.txt` with pass/fail.


#### Medium — Verify + Minor Config / Patches

- [ ] **[Fix] Torch — configure for Nimble item schema** — Read `~/foundryVTT/foundrydata/Data/modules/torch/torch.js` to find how it searches an actor's inventory for a torch item (item type, name pattern, uses/quantity field path). Compare against Nimble's item data model in `src/models/item/`. Either configure Torch's module settings to match Nimble field paths, or add a small compatibility hook in `src/hooks/` that exposes torch item data in the format Torch expects. Test: equip a torch item on an actor; confirm the Torch HUD button appears and toggling it lights the token. Run `/nimble-review`. Run `/nimble-e2e-tester`. Update `progress.txt`.

- [ ] **[Audit] Foundry MCP Bridge actor creation** — Use the MCP bridge to create a Nimble actor via the AI interface. Observe the network/console for schema errors or missing required fields. If a Nimble required field is absent and has a safe default, add it to the actor data model default in `src/models/actor/`. Run `/nimble-review`. Update `progress.txt` with any mismatches found.

#### Complex — New Assets / Configuration

- [ ] **[Build] Automated Animations Nimble preset config** — Create `docs/automated-animations-nimble.json` containing a custom automations config for the `autoanimations` module. Map common Nimble spell and item names (e.g., Fireball, Magic Missile, Shortsword) to JB2A animation keys from the installed `JB2A_DnD5e` pack. Cover at minimum: 5 spells, melee attack, ranged attack. Import the JSON via Automated Animations → Custom Automations and confirm animations fire in a live test. Run `/nimble-e2e-tester`. Update `progress.txt`.

#### Roadmap (out of scope for this repo)

- [ ] **[Roadmap] Token Action HUD companion module** — `token-action-hud-core` requires a companion system module to function. No `token-action-hud-nimble` exists yet. Create a note in `docs/module-compatibility.md` describing the module API contract and the action groups needed (attacks, spells, boons, items, rests, conditions). This is a standalone future project (separate repo). Update `progress.txt`.


### Core Mechanics
- [ ] REVISITED: "When an attack inflicts a condition, it should automatically toggle the status condition in the targets `conditions` tab to on." This is not working.
test with:
- actor:Cultist should apply 'dispair' to adjacent enemies with 'oblation of blood'
- actor:Mage should apply 'blind' to enemis with 'snowblind'
- actor:Mummy lord should apply 'dazed' with 'slam(x2)'
I have set those actors on the current scene in battle mode, use nimble-e2e-tester

- [ ] **[Audit] Monks Active Tile Triggers** — Build a test scene with tile triggers for each action category: teleport, play sound, show text/journal, open/close door. Also test actions that call system APIs: apply damage, apply condition, roll saving throw. Document which work and which throw errors. If any system-adjacent actions fail, check whether a small Nimble hook can provide the required data. Update `progress.txt` with a pass/fail table for each action type.


### Actor Documents


### Item Documents


### Dice & Rolls


### UI / Sheets


### Localization


### Compendia / Packs
- [ ] Add a commoner NPC actor to `packs/actors/` with stat stat block and token image placeholder

### Tooling

