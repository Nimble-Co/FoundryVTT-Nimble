# Nimble 2 — Product Requirements Document

## Instructions for Ralph
- Read this file and `progress.txt` at the start of each iteration.
- Pick the first unchecked task. If on stage cut a new branch (follow branch name standards). 
- Implement the task, commit, then update `progress.txt`.
- Mark the task `[x]` in this file when done.

## Tasks

### Bugs
- [x] When rolls are made with the sidebar collapsed the chat wont populate with the results. But if the chat window is open then the rolls register and the card with results populates.

### Core Mechanics
- [x] Add a `pnpm test` smoke-test that verifies all document proxy classes load without error
- [x] Check if docker is set up, if it is, create docker sandbox to impliment afk-ralph.sh

### Actor Documents
- [ ] Add a `totalArmor` derived getter on the character actor that sums equipped armor items
- [ ] Ensure the NPC actor sheet displays the actor's CR (Challenge Rating) from its data model

### Item Documents
- [ ] Add a `isEquipped` boolean field to the base item data model with default `false`
- [ ] Wire the `isEquipped` toggle in the item sheet UI so clicking it persists the value

### Dice & Rolls
- [ ] Write unit tests for `NimbleRoll` covering critical success and critical failure cases
- [ ] When an attack damage is added, it should automatically the status condition in the targets `conditions` tab

### UI / Sheets


### Localization
- [ ] Audit `src/config.ts` constants and ensure every user-facing string has a matching key in the en.json lang file
- [ ] Add a `pnpm i18n-check` script that warns on missing or unused localization keys

### Compendia / Packs
- [ ] Add a sample Boon item to `packs/items/` with placeholder name, description, and effect
- [ ] Add a sample NPC actor to `packs/actors/` with stat block and token image placeholder
- [ ] Add a commoner NPC actor to `packs/actors/` with stat stat block and token image placeholder

### Tooling

