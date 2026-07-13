# Compendium ↔ Nimble Vault cross-check (class feature options)

Compares the FoundryVTT compendium class-feature data (`packs/classFeatures/core/<class>/`)
against the canonical rulebook markdown (Nimble Vault `Heroes/Classes/<Class>/`).

**Bottom line:** the selectable **option pools** and **subclass options** are complete and
correct in membership and level placement for all 11 classes — the level-up flow (#708)
surfaces the right options. Discrepancies are (1) a handful of real `gainedAtLevels` data
bugs and (2) cosmetic name differences. Generic cross-class rows (Stat Increases, Subclass
markers, Epic Boon, Upgraded Cantrips, Tier N Spells) are handled generically and are not
modeled as class-feature JSON — not treated as defects.

## Option pools verified matching (names + levels)

| Class | Pools (count) |
|-------|---------------|
| Berserker | Savage Arsenal (12) |
| Commander | Combat Tactics (5), Commander's Orders (6), Weapon Mastery (3) |
| Hunter | Thrill of the Hunt (14) |
| Mage | Spellshaper (8) |
| Oathsworn | Sacred Decree (10) |
| Shadowmancer | Lesser Invocations (10), Greater Invocations (11) |
| Shepherd | Sacred Graces (8) |
| Songweaver | Lyrical Weaponry (5), A "People" Person (4, choose 2) |
| Stormshifter | Chimeric Boon (9), Direbeast Form (3) |
| The Cheat | Underhanded Abilities (10) |
| Zephyr | Martial Arts Abilities (11) |

Subclass options per level match for every class (shadowmancer & shepherd were authored
from the compendium in this PR and verified against the vault) — except the hunter
Beastmaster level bugs below.

## Real data bugs (features may not surface at level-up) — worth fixing

1. **Hunter / Beastmaster** — companion features with `gainedAtLevels: null` (never granted):
   `medium-ferocious.json`, `large-alpha-protector.json`, `medium-protect-me.json`.
   Also `small-protect-me.json` base level `[2,7]` is inconsistent with sibling Small
   companion abilities (`[1,...]`).
2. **Stormshifter / Archdruid** (`archdruid.json`) — has only scalar `gainedAtLevel: 20`,
   missing the `gainedAtLevels` array every sibling populates; may not surface at L20 in
   logic that reads the array.

## Name discrepancies (compendium vs vault) — cosmetic

| Class | Compendium | Vault |
|-------|-----------|-------|
| Commander | `Inerrant Strike.`, `Experienced Commander.`, `Survey the Battlefield.` | (no trailing period) |
| The Cheat | `Cheat!`, `Twist the Blade (1)`, `Amidst All This Commotion` | `Cheat`, `Twist the Blade`, `Amidst All This Commotion…` |
| Mage | `Spell Shaper` | `Spellshaper` |
| Oathsworn | `Radiant Judgement` | `Radiant Judgment` |
| Zephyr | `Martial Arts Ability` (progression feature) | `Martial Master` (the pool itself is correctly "Martial Arts Abilities") |
| Shadowmancer | `Gift from the Master`, `Greedy pact` | `A Gift from the Master`, `Greedy Pact` |
| Songweaver | `A People Person`, `Wind Spellcasting and...` | `A "People" Person`, `Wind Spellcasting and…` |
| Shepherd | `Sacred Graces` (progression feature) | `Sacred Grace` |
| Stormshifter | `Stormborn (1)` | `Stormborn` (the L13 `Stormborn (2)` matches) |

## Upgrade-instance modeling (design choice; a couple of gaps)

Repeated features are generally modeled via `gainedAtLevels` arrays rather than separate
`(2)`/`(3)` items — fine. Two where an upgrade level appears missing:
- **Songweaver / Windbag** — vault grants at L3/6/14; compendium `[3]` only.
- **Zephyr / Unyielding Resolve** — vault grants at L4/10/17; compendium `[4]` only.

## Needs a manual glance (markdown parsing limitation, low confidence)

- **Shadowmancer L1** — vault lists `Shadow Blast` and `Summon Shadows` at L1; not present
  as progression JSON (likely modeled as spells/actions elsewhere).
- **Commander / Spellblade** — compendium has 9 L1 options (Arcane Command, Borne Upon the
  Wind, Crystalline Armor, Flashstep, Glimmering Decree, Rising Phoenix, Withering Strike,
  plus Firebrand L3 and Deep Knowledge). The vault Spellblade file formats the L1 options in
  a way a simple bold-line grep didn't fully enumerate — confirm the option list matches.

## Method

- Compendium: `name`, `system.group`, `system.gainedAtLevels`, `system.subclass` from each JSON.
- Vault: `**Bold**` feature names under `### Level N` headers, per pool / subclass file.
- Names normalized for curly→straight apostrophes; case/punctuation diffs reported.
