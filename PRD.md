# Nimble 2 — Product Requirements Document

## Instructions for Ralph
- Read this file and `progress.txt` at the start of each iteration.
- Pick the first unchecked task. If on stage cut a new branch (follow branch name standards). 
- Implement the task, commit, then update `progress.txt`.
- Mark the task `[x]` in this file when done.

## Tasks

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
- [ ] When an attack inflicts a condition, it should automatically toggle the status condition in the targets `conditions` tab to on. 

### UI / Sheets


### Localization
- [ ] Audit `src/config.ts` constants and ensure every user-facing string has a matching key in the en.json lang file

### Compendia / Packs
- [ ] Add a commoner NPC actor to `packs/actors/` with stat stat block and token image placeholder

### Tooling

