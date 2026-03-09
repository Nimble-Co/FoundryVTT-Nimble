# Nimble 2 — Product Requirements Document

## Instructions for Ralph
- Read this file and `progress.txt` at the start of each iteration.
- Pick the first unchecked task. If on stage cut a new branch (follow branch name standards).
- Implement the task, commit, then update `progress.txt`.
- Mark the task `[x]` in this file when done.
- **Task ordering standard:** Audit and cleanup tasks (duplicate features, dead code, upstream overlap) always go at the top of the task list, before bugs and new features. When adding new tasks, place audits first.

## Tasks


### Bugs


### Core Mechanics
- [ ] REVISITED: "When an attack inflicts a condition, it should automatically toggle the status condition in the targets `conditions` tab to on." This is not working.
test with:
- actor:Cultist should apply 'dispair' to adjacent enemies with 'oblation of blood'
- actor:Mage should apply 'blind' to enemis with 'snowblind'
- actor:Mummy lord should apply 'dazed' with 'slam(x2)'
I have set those actors on the current scene in battle mode, use nimble-e2e-tester

### Actor Documents


### Item Documents


### Dice & Rolls


### UI / Sheets


### Localization


### Compendia / Packs
- [ ] Add a commoner NPC actor to `packs/actors/` with stat stat block and token image placeholder

### Tooling

