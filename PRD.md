# Nimble 2 — Product Requirements Document

## Instructions for Ralph
Read this file and `progress.txt` at the start of each iteration.
Pick the first unchecked task. Implement it, commit, then update `progress.txt`.
Mark the task `[x]` in this file when done.

## Tasks

### Core Mechanics
- [ ] Add a `pnpm test` smoke-test that verifies all document proxy classes load without error

### Actor Documents
- [ ] Add a `totalArmor` derived getter on the character actor that sums equipped armor items
- [ ] Ensure the NPC actor sheet displays the actor's CR (Challenge Rating) from its data model

### Item Documents
- [ ] Add a `isEquipped` boolean field to the base item data model with default `false`
- [ ] Wire the `isEquipped` toggle in the item sheet UI so clicking it persists the value

### Dice & Rolls
- [ ] Write unit tests for `NimbleRoll` covering critical success and critical failure cases

### UI / Sheets
- [ ] Add a tooltip component `<Tooltip>` in `src/view/components/` for hover text on stat labels

### Localization
- [ ] Audit `src/config.ts` constants and ensure every user-facing string has a matching key in the en.json lang file
- [ ] Add a `pnpm i18n-check` script that warns on missing or unused localization keys

### Compendia / Packs
- [ ] Add a sample Boon item to `packs/items/` with placeholder name, description, and effect
- [ ] Add a sample NPC actor to `packs/actors/` with stat block and token image placeholder

### Tooling
- [ ] Configure Vitest coverage reporting (add `coverage` script to package.json, threshold 50%)
- [ ] Add a `pnpm size` script using `vite-bundle-visualizer` to inspect bundle output
