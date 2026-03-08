# Nimble 2 — Product Requirements Document

## Instructions for Ralph
- Read this file and `progress.txt` at the start of each iteration.
- Pick the first unchecked task. If on stage cut a new branch (follow branch name standards).
- Implement the task, commit, then update `progress.txt`.
- Mark the task `[x]` in this file when done.
- **Task ordering standard:** Audit and cleanup tasks (duplicate features, dead code, upstream overlap) always go at the top of the task list, before bugs and new features. When adding new tasks, place audits first.

## Tasks

### Upstream Overlap Audit (2026-03-08)
The following tasks were identified by a code review comparing fork changes against `upstream/dev`. Each describes a fork feature that may duplicate upstream NCSW functionality. Investigate before implementing further work in the overlapping area.

- [ ] **Audit `atkInit.ts` float-card vs upstream NCSW non-minion attack path.** The fork adds `src/hooks/atkInit.ts` — a `window._nimbleShowCard` floating attack card invoked by hotbar macros (`atk-melee.json`, `atk-ranged.json`, `atk-spells.json`). Upstream NCSW already handles single NPC (non-minion) attack rolls: select the NPC token in combat, pick an action in the NCSW panel, and click roll — it calls `actor.activateItem` with the full formula. The float card duplicates the action-selection + formula-display + roll + apply-damage flow for NPC `monsterFeature` actions, bypassing the Nimble activation system (no active effects, no chat card, no target resolution). Decide whether to: (a) remove `atkInit.ts` and teach GMs to use the NCSW panel instead, (b) keep it only for PC weapon attacks (where NCSW does not apply) and remove NPC handling, or (c) document it as intentional for out-of-combat quick-roll scenarios. Note: the macros that invoke `_nimbleShowCard` are in `packs/macros/core/` and would also need updating or removal.

- [ ] **Verify `startingGear.ts` does not duplicate upstream character creation logic.** The fork adds `src/hooks/startingGear.ts`, which auto-equips every new `character` actor with a hard-coded list of items from `nimble.nimble-items`. Upstream has no equivalent in its hooks. However, upstream may handle starting equipment via the class/ancestry/background grant system or via the level-up flow. Confirm upstream has no starting-gear mechanism before keeping this hook. If upstream adds one in a future merge, the fork hook will double-grant items. The hook also hard-codes four specific pack document IDs (`MNFxluopbBHRBybK`, `DBeqkbYmH1xEvdDA`, `7ZPoo93Dm8dVHO99`, `Zn4ohFLqqKP1W52v`) which will silently fail if the compendium is updated or IDs change.

- [ ] **Confirm `hideGroupAttackPanel` setting + panel toggle button is genuinely needed vs upstream default behaviour.** The fork adds a `hideGroupAttackPanel` client setting (with `requiresReload: true`) plus a `nimble-ncsw-panel-toggle` scene control button. Upstream does not have this — the NCSW panel always appears when eligible tokens are selected in combat. If the user's table finds the auto-appearing panel disruptive, this fork feature is justified. However, the `requiresReload: true` flag makes the UX awkward; the panel toggle button is meant to avoid reloads but only works while the setting is enabled. Consider whether a simpler approach (always-visible close button already exists in the panel) is sufficient, and whether `requiresReload` can be dropped since the toggle button already handles live state via `loadPanelUserVisible` / `savePanelUserVisible`.


### Bugs
- [x] When rolls are made with the sidebar collapsed the chat wont populate with the results. But if the chat window is open then the rolls register and the card with results populates.
- [x] On the remote server https://foundryvtt.redirectme.net/game im unable to roll skill checks from the token sheet. I can roll attacks just fine. This doesnt seem to be an issue on my local.

### Core Mechanics
- [x] Add a `pnpm test` smoke-test that verifies all document proxy classes load without error
- [x] Check if docker is set up, if it is, create docker sandbox to impliment afk-ralph.sh

### Actor Documents


### Item Documents


### Dice & Rolls
- [x] Write unit tests for `NimbleRoll` covering critical success and critical failure cases
- [x] When an attack inflicts a condition, it should automatically toggle the status condition in the targets `conditions` tab to on.

### UI / Sheets


### Localization
- [x] Audit `src/config.ts` constants and ensure every user-facing string has a matching key in the en.json lang file

### Compendia / Packs
- [ ] Add a commoner NPC actor to `packs/actors/` with stat stat block and token image placeholder

### Tooling


### Upstream Overlap Audit (2026-03-08)
The following tasks were identified by a code review comparing fork changes against `upstream/dev`. Each describes a fork feature that may duplicate upstream NCSW functionality. Investigate before implementing further work in the overlapping area.

- [ ] **Audit `atkInit.ts` float-card vs upstream NCSW non-minion attack path.** The fork adds `src/hooks/atkInit.ts` — a `window._nimbleShowCard` floating attack card invoked by hotbar macros (`atk-melee.json`, `atk-ranged.json`, `atk-spells.json`). Upstream NCSW already handles single NPC (non-minion) attack rolls: select the NPC token in combat, pick an action in the NCSW panel, and click roll — it calls `actor.activateItem` with the full formula. The float card duplicates the action-selection + formula-display + roll + apply-damage flow for NPC `monsterFeature` actions, bypassing the Nimble activation system (no active effects, no chat card, no target resolution). Decide whether to: (a) remove `atkInit.ts` and teach GMs to use the NCSW panel instead, (b) keep it only for PC weapon attacks (where NCSW does not apply) and remove NPC handling, or (c) document it as intentional for out-of-combat quick-roll scenarios. Note: the macros that invoke `_nimbleShowCard` are in `packs/macros/core/` and would also need updating or removal.

- [ ] **Verify `startingGear.ts` does not duplicate upstream character creation logic.** The fork adds `src/hooks/startingGear.ts`, which auto-equips every new `character` actor with a hard-coded list of items from `nimble.nimble-items`. Upstream has no equivalent in its hooks. However, upstream may handle starting equipment via the class/ancestry/background grant system or via the level-up flow. Confirm upstream has no starting-gear mechanism before keeping this hook. If upstream adds one in a future merge, the fork hook will double-grant items. The hook also hard-codes four specific pack document IDs (`MNFxluopbBHRBybK`, `DBeqkbYmH1xEvdDA`, `7ZPoo93Dm8dVHO99`, `Zn4ohFLqqKP1W52v`) which will silently fail if the compendium is updated or IDs change.

- [ ] **Confirm `hideGroupAttackPanel` setting + panel toggle button is genuinely needed vs upstream default behaviour.** The fork adds a `hideGroupAttackPanel` client setting (with `requiresReload: true`) plus a `nimble-ncsw-panel-toggle` scene control button. Upstream does not have this — the NCSW panel always appears when eligible tokens are selected in combat. If the user's table finds the auto-appearing panel disruptive, this fork feature is justified. However, the `requiresReload: true` flag makes the UX awkward; the panel toggle button is meant to avoid reloads but only works while the setting is enabled. Consider whether a simpler approach (always-visible close button already exists in the panel) is sufficient, and whether `requiresReload` can be dropped since the toggle button already handles live state via `loadPanelUserVisible` / `savePanelUserVisible`.
