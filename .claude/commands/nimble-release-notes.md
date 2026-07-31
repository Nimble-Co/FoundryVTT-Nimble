---
name: 'nimble-release-notes'
description: 'Generate a Nimble release note from a git range. Usage: /nimble-release-notes [range] [version] [screenshots]'
argument-hint: '[base..head] [X.Y.Z] [screenshots]'
---

# Generate release notes

Write the release notes for the Nimble FoundryVTT system.

## Arguments

- `$1` : git range, e.g. `main..dev`. **Default `main..dev`** if not given.
- `$2` : version, e.g. `0.9.0`. If not given, use `X.Y.Z` as a placeholder and say so at the end.
- `$3` : pass `screenshots` to opt into capturing images. **Omitted means no screenshots.**

Full invocation as typed: `$ARGUMENTS`

Resolve the arguments first and state them back in one line before starting, so a wrong range
is caught immediately. If the range produces zero commits, stop and say so rather than
inventing content.

## Output

Write the markdown to `release-notes-<version>.md` in the root folder, these are gitignored.

---

## Step 1: gather the facts from the repo, not from memory

Run these and read the output before writing a word:

```bash
git log --oneline $1                    # the PR list
git log $1 --format='===== %h %s%n%b'   # full bodies: this is where the real detail is
git diff --stat $1 | tail -3
git diff --name-status $1 -- src/models/rules/ | grep '^A'   # new rule types
git diff --name-status $1 -- src/migration/ | grep '^A'      # new migrations
git diff --name-status $1 -- packs/                          # content changes
git log $1 --format='%h %s%n%b' | grep -niE '(clos|fix|resolv)e[sd]? #[0-9]+'  # issue links
```

Squashed PR bodies contain the sub-commit messages. That is the primary source: it explains
what each change does and why, which the PR title never does.

## Step 2: verify every number against the tree

Never take a count from a commit message. Check it:

- Rule types: `grep -c "NIMBLE.ruleTypes\." src/config/registerRulesConfig.ts` on both ends of
  the range. Count the registry, not files in `src/models/rules/` (that directory contains
  base classes and helpers that are not rule types).
- Schema version: `grep LATEST_SCHEMA_VERSION src/migration/MigrationRunnerBase.ts`
- Content claims: read the pack JSON. To see which features actually carry automation, count
  rules per file and check for `note` nodes in `system.activation` for the ones with none.
  "Has no rules" is not the same as "not implemented yet": some features are purely
  narrative. Ask before listing anything as outstanding work.

## Step 3: get attribution right

**The squash-merge author is often not the person who wrote the code.** Two rules:

1. Resolve identities by **commit email**, not display name. The same person appears under
   multiple names in this repo (for example one user might have different names but use the same email, this is one person and should only have one @ attribution). Crediting them twice is wrong.
   GitHub handles come from noreply addresses (`1043042+user_y@...` etc should be treated properly with their @).
2. For any PR where you are attributing more than two or three bullets, check whether the
   unsquashed branch still exists and split by commit:

```bash
git branch -a --list '*<topic>*'
git log --format='%an | %s' <base>..<branch>
```

A large PR frequently has two authors: one builds the foundation, another adds capability on
top. Attribute per bullet, not per PR.

Run `git log --all --format='%an <%ae>' | sort -u` once and build the name-to-handle map
before writing.

## Step 4: resolve the issue number behind each PR

A PR number says what was merged; the issue says what was wrong. Include both whenever the
issue can be established from the repo. Two conventions are in use:

1. **Subject line.** `fix(dicepool): let players add dice to their own pool (#803) (#846)`.
   The **last** number is the merge PR, any earlier one is the issue. A subject with a single
   trailing number (`chore: add worktree:reset script (#834)`) is PR-only, no issue.
2. **Body keywords.** `Closes #406`, `Fixes #835`, `Resolves #822`, often several per PR.
   These are the reliable source: check the body even when the subject already carries a
   number, because a squashed PR frequently closes issues the title never mentions.

```bash
git show -s --format='%b' <sha> | grep -iE '(clos|fix|resolv)e[sd]? #[0-9]+'
```

Match issues **per bullet**, the same way as authors. When a PR closes three issues and made
three distinct changes, each bullet gets the issue it actually fixed, not all three. If a
bullet cannot be tied to a specific issue with confidence, give it the PR number alone: a
wrong issue link is worse than a missing one.

Never invent or infer an issue number from context, a version or a topic name. It has to come
from the subject line or the commit body. If you cannot tell whether a number in a subject is
an issue or a co-referenced PR, leave it off and note it in the assumptions at the end.

## Step 5: structure

```
# Version <version>

Compatibility / manifest line
> Back up your world (only if migrations run)

3 short paragraphs: the biggest changes, then a pointer to the behaviour changes section

## Additions / Changes      (subsystem subheadings: Toggles, Dice pools, Combat, Spells, ...)
## Fixes                    (same subheadings)
## System Data              (compendium and content changes)
## Behaviour changes        (only things that could surprise an existing world)
## Migrations               (table: number -> what it repairs)
Contributors + the Patreon/Ko-fi line
```

Entry format: `- [#PR] [#issue, #issue] Description. @contributor`

The first bracket is always the merge PR. The second bracket holds the issue(s) that bullet
resolves and is **omitted entirely** when none was found, leaving the plain
`- [#123] Description. @contributor` form from `docs/RELEASE_GUIDE.md`. Examples:

```
- [#846] [#803] Players can add dice to their own pool. @contributor
- [#831] [#406, #412] Hardy grants advantage on hit dice. @contributor
- [#834] Added a worktree:reset script. @contributor
```

## Step 6: granularity, the main thing

**One bullet per change, not per PR.** A PR that did nine things gets nine bullets. The same
PR number appearing twenty times is correct and expected. The bullet's job is to name the
specific fix; the PR number is just a link.

Do not merge several changes into one bullet to keep the list short. The list is allowed to
be long. What is not allowed is a bullet that says less than what happened.

## Step 7: voice

Depth means saying what changed **and** what it means at the table. Not more adjectives.

- **No "it plays itself", no "the system does it for you"** when describing class features.
  Nimble is built on player agency: the system *tracks* state and *offers* choices, the
  player decides. Write "Rage is a state you switch on and off" and "spending them opens a
  panel where you pick which dice to spend", never "the Berserker plays itself". ("Not yet
  automated" is fine when describing a *feature's* support level: that is standard Foundry
  vocabulary and says nothing about the player.)
- **Name the symptom, not the code path.** "Your hero was left at 0 actions after clicking
  End Turn" beats "`_onEndTurn` was skipped". Mention internals only when a homebrewer needs
  them.
- **State scope limits explicitly.** "First target only, AoE cards exempt, token movement
  stays manual" turns a future bug report into a documented decision.
- **Separate generic engine work from the class that motivated it.** Homebrewers cannot use
  what they do not know exists.
- **No em-dashes anywhere.** Use commas, colons, parentheses or a full stop. Hard project rule.
- **No essay voice.** No "the theme of this release is", no rhetorical setups, no narrating
  the journey. Cut any sentence that exists only to introduce another sentence.
- Keep prose to the three-paragraph intro plus at most one line of context under a heading.
  Everything else is bullets.

**Behaviour changes** is a required section whenever an existing world or existing homebrew
could break. It is neither an addition nor a fix and belongs in neither list. Typical
triggers: something that used to happen implicitly stopped, a field that was ignored started
being honoured, an interaction changed meaning.

## Step 8: self-check before handing it over

- [ ] Every number verified against the tree, not a commit message
- [ ] No PR collapsed into one bullet when it made several distinct changes
- [ ] Every issue number traced to a subject line or a `Closes`/`Fixes`/`Resolves` body line,
      never guessed; bullets with no confident match carry the PR number only
- [ ] Contributors deduplicated by email; no one credited twice under two names
- [ ] Multi-author PRs split per bullet
- [ ] Zero em-dashes (`grep -cP '\x{2014}' <file>` returns 0)
- [ ] No wording that implies the system plays for the player
- [ ] Behaviour changes section present, or consciously omitted because there are none
- [ ] Anything assumed (version, unverified handle, a URL not loaded) listed explicitly at
      the end

State assumptions at the end rather than silently guessing. If a fact needs the user, ask
once, at the end, having finished everything else.

---

## Screenshots: only if `$3` is `screenshots`

If that argument was not passed, skip this entirely and do not offer to do it inline; just
mention at the end that `/nimble-release-notes $1 $2 screenshots` would add them.

If it was passed:

1. Build and link **first**, from the target worktree
   (`pnpm worktree:setup -- "/path/to/foundry/data" --overwrite`), **then** start
   Foundry (`runv13`). Foundry has no hot reload and caches the manifest at startup: if the
   server is already running, or starts before the build finishes writing, you are
   screenshotting the previous build. Verify the ordering (`stat dist/system.json` against the
   server process start time) before believing anything you capture. Kill any existing
   instance on :30000 first.
2. Drive the **real UI** for the action being shown: click the switch, click the weapon row,
   pick the dice. Console calls are for setup only (placing tokens, setting a monster's
   resistances, targeting) and for reading state back. Never present a console-driven
   simulation as a captured feature.
3. Gotchas that cost real time:
   - Do not close every application to tidy up: that closes the sidebar too, and chat cards
     then render at zero size or off-screen. Keep `ui.sidebar`, `ui.hotbar`, `ui.players`,
     `ui.nav`, `ui.controls`, `ui.chat`.
   - Expand the sidebar, activate the chat tab, then `scrollIntoView()` the newest card before
     measuring or shooting it.
   - Some UI (the dice pool tracker) is a DOM descendant of the sheet but positioned outside
     its bounding box, so an element screenshot clips it. Shoot a union bounding box instead.
   - `#nimble-minion-group-attack-panel` intercepts pointer events while a combat is active.
     Delete the combat or hide it.
   - Capture at `deviceScaleFactor: 2` and display at half size.
4. Embed with `<img src="./images/x.png" width="300">`, not markdown image syntax. Chat cards
   read well at 300px, panels around 330px, full sheets 360px.
5. Clean the test data back out of the world afterwards: tokens, cloned actors, combat,
   lingering effects, chat.

