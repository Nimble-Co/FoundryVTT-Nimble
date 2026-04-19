---
title: "Dice Engine"
outline: deep
---

# Dice Engine — Overview

A plain-English guide to how the Nimble dice engine works in this system. Written for teammates, content authors, and future-you — not for someone doing surgery on the engine internals.

## What makes Nimble dice weird

Most TTRPGs roll dice and add things up. Nimble does that too, but with a twist that breaks how most dice engines are built:

**Only one die — the "Primary Die" — decides whether you hit, miss, or crit.** The rest of the dice in your damage pool just add to the total.

The Primary Die is whichever base-weapon die is **leftmost** in your pool. Everything else (sneak attack, bonus elemental damage, Vicious extras, +X damage from a buff) adds to damage but **can never** cause a crit or a miss.

On top of that:

- **Crit** = Primary Die rolls its maximum value. You reroll the Primary Die, add it to damage, and repeat as long as it keeps rolling max.
- **Miss** = Primary Die rolls a 1. Damage from bonus dice still doesn't matter — you missed.
- **Advantage** = add one more die of the same type to the pool, drop the lowest. On ties, drop the leftmost tied die. Disadvantage is the same but drops the highest.
- **Adv + Dis cancel 1-for-1 before rolling.** Two advantages and one disadvantage net to one advantage.
- **AoE / multi-target attacks** can't miss and can't crit. One roll applies to everyone hit.
- **Minions and no-proficiency weapons** can't crit.

The "one primary die" model covers most weapons, but some abilities break it. Dravok's Terrible Maw rolls `4d4` where **every** die can independently crit with vicious explosion. d66/d88 lookup rolls use `2d6` where **neither** die can crit or miss. Mixed pools like a vicious weapon plus sneak attack (`1d8 + 2d6`) have one die that crits viciously while the rest are plain damage. The engine handles all of these through **die modifiers** — short tokens appended to individual dice in the formula that control their crit/miss/explosion behavior.

## Die modifier vocabulary

Each die in a formula can carry a modifier that tells the engine how to treat it:

| Modifier | Meaning | Example |
|----------|---------|---------|
| `c` | Can crit. Max value → standard explosion chain (reroll, add to damage, repeat while max). | `1d8c` — standard weapon |
| `cv` | Can crit with vicious explosion. Max value → roll 2 dice, left can chain, right cannot. | `1d8cv` — vicious weapon, `4d4cv` — Dravok |
| `v` | Vicious metadata only. No crit detection. Warns if used without `c`. | — (rarely used alone) |
| `n` | Neutral. No crit, no miss. Value contributes to damage normally. | `2d6n` — d66 roll, `2d8n` — AoE damage |

**Formula examples:**

| Formula | Meaning |
|---------|---------|
| `1d8c` | Standard single-die weapon. Primary die crits with standard explosion. |
| `1d8cv` | Vicious weapon. Primary die crits with vicious explosion (2 dice per chain). |
| `4d4cv` | Dravok's Terrible Maw. Each d4 independently checks crit, each with vicious explosion. |
| `2d6n` | d66 tens-and-ones lookup. Neither die can crit or miss. |
| `1d8cv + 2d6` | Vicious weapon plus sneak attack. The d8 crits viciously; the 2d6 are plain damage. |

When a formula contains any Nimble modifier, the roll enters **modifier-mode** — the engine reads each die's modifier metadata instead of extracting a single primary die. This is transparent to callers: existing roll-level options (`canCrit`, `canMiss`, `isVicious`) are still accepted and translated to modifiers via a constructor shim.

You can also type `/r 4d4cv` in Foundry chat to roll modifier-mode formulas directly. `DamageRoll.matches()` claims any formula containing Nimble modifiers, so the engine handles them instead of Foundry's base Roll class.

### The subtlety that breaks naive implementations

Suppose you have `2d6` with advantage. That's a 3-dice pool: roll three, drop the lowest, keep two.

Say you roll `[1, 2, 6]` (left to right). Naively, "the leftmost die is the primary" would pick the `1` → miss. Wrong.

**Advantage is resolved first.** The leftmost `1` is dropped (it's the lowest). The remaining pool is `[2, 6]`. The leftmost of *those* — the `2` — is now the Primary Die. That's a hit for 8 damage.

You can't pick the primary die first and then roll the rest. The whole pool rolls together, the drops happen, and *then* you find out which die was primary. Every correct Nimble dice implementation has to honor this ordering, and every incorrect one gets hit/miss/crit wrong in tie scenarios.

This is the load-bearing insight. If you only remember one thing from this doc, remember that.

## How a roll flows through the code

When a player clicks "Attack" on a weapon, here's what happens (all in `src/dice/` and `src/managers/`):

1. **`ItemActivationManager` builds the roll request.** It gathers: the weapon's damage formula, any bonus dice from features, a list of advantage/disadvantage sources, target info, and flags like "is this AoE?" and "is the attacker proficient with this weapon?".

2. **Advantage and disadvantage sources are netted.** If two features give `+1 adv` and one gives `+1 dis`, the net is `+1 adv`. A single integer is passed to the next step.

3. **`DamageRoll` constructs the formula.** The constructor checks whether the formula contains Nimble die modifiers (`c`, `cv`, `n`). If so, the roll enters **modifier-mode** — each die's behavior comes from its modifier metadata, and no PrimaryDie extraction happens. If no Nimble modifiers are present, the **legacy path** runs: the constructor separates the primary pool from bonus dice and applies AoE / proficiency / minion flags.

4. **Extra dice are added for advantage/disadvantage.** `|net|` extra dice get added, and a custom modifier (`khn` for advantage, `kln` for disadvantage) is emitted. This works in both modes. `khn` = "keep highest Nimble." `kln` = "keep lowest Nimble." These are the Nimble-tie-aware versions of Foundry's built-in `kh`/`kl`.

5. **Foundry rolls the dice.** The custom `khn`/`kln` modifier handlers sort results and mark dice as discarded (leftmost dropped on ties). In modifier-mode, the `c`, `cv`, `v`, and `n` handlers also run — they attach Symbol-keyed metadata to each Die instance describing its crit/miss/explosion behavior. These handlers don't roll extra dice; they only tag metadata.

6. **`DamageRoll._evaluate` interprets the results.** In modifier-mode, the engine iterates all Die terms, reads their modifier metadata, and dispatches per-die: `cv`-tagged dice that rolled max get a vicious explosion chain, `c`-tagged dice use Foundry's native `x` explosion, `n`-tagged dice are skipped for crit/miss. In legacy mode, the engine reads the single primary die and dispatches based on the `explosionStyle` option (`'none'` / `'standard'` / `'vicious'`). Crit detection in both modes uses the same value-based check: did a kept (active, non-discarded) die roll its max face value?

7. **Post-roll mutation hook.** A no-op method `_applyPostRollMutations` is called between the dice rolling and the outcome being finalized. Today it does nothing. It's there as an extension point (see below).

8. **Finalize the total.** `_finalizeOutcome` sets `isCritical` / `isMiss` flags and adjusts the total for vicious recalculation and the `primaryDieAsDamage: false` case (where the primary die's value is excluded from damage but its explosions still count). Crit detection is a single value-based check — did the kept primary die roll its maximum? — and works the same regardless of which `explosionStyle` is active.

9. **The chat card renders** (handled in `src/view/chat/components/`, outside the engine). The card shows the kept and dropped dice, the primary die, bonus dice, and the total.

## Extension points for content authors

If you're adding a class feature, monster trait, or spell that does something unusual with dice, here's where it plugs in. **You should almost never have to modify `DamageRoll.ts` itself** — that's the whole point of the structure below.

### Post-roll mutation hook — `_applyPostRollMutations`

Today this is an empty method called from `_evaluate` after Foundry rolls the dice but before the outcome is finalized. It's reserved for features that need to **change a die's value after it's rolled**, then have hit/miss/crit re-evaluated against the new value. Examples of features that will land here:

- **Hexbinder "Doomed"** — "Next roll against target has every die treated as max." That's a post-roll value override on a subset of the pool.
- **Cheat class "Vicious Opportunist"** — "On hitting a Distracted target, set the Primary Die to any value you choose. Setting it to max counts as a crit."
- **Berserker "Blood Frenzy"** — "On crit, set a Fury Die to its maximum value."
- **Hexbinder "Soothsayer"** — "Expend a Futuresight Die to add or subtract 1 from any die rolled, clamped to its natural range."

When one of these lands, the feature's logic lives in its own rule file and gets invoked from `_applyPostRollMutations`. The rule mutates `primaryDie.results[].result` and returns. `_finalizeOutcome` then re-reads the primary die state and the outcome updates automatically.

### Custom Die modifiers — `nimbleDieModifiers.ts`

Die modifiers control per-die behavior: crit capability, explosion style, and neutrality. The engine ships with `c`, `cv`, `v`, `n` (plus `khn`/`kln` for tie-aware advantage/disadvantage). Each modifier is a handler function registered on `Die.MODIFIERS` via `registerNimbleDieModifiers()` at system init.

Modifiers attach Symbol-keyed metadata to the Die instance during evaluation. The engine reads this metadata via `getNimbleMods(die)` during finalization. Modifiers never roll extra dice or mutate results — they're pure metadata. The explosion and crit logic lives in `DamageRoll._evaluate`.

To add a new modifier: write a handler that attaches metadata via the `NIMBLE_MODS` symbol, register it in `registerNimbleDieModifiers()`, and emit the modifier token in the formula from wherever you build the roll. See the existing `c`/`cv`/`n` handlers in `nimbleDieModifiers.ts` for the pattern.

### AoE auto-flagging — `ItemActivationManager`

Any item whose `activation.template.shape` is set (cone, circle, line, emanation, square) automatically gets `canCrit: false, canMiss: false`. No opt-in from the content author needed — define the activation template shape normally and it works.

**Note on multi-target abilities:** `targets.count > 1` is **not** treated as an AoE signal. The Nimble rule that AoE attacks can't crit or miss exists because there's *one shared roll* applied to every target. Most multi-target abilities (Magic Missile, "make two attacks against different targets," etc.) roll separately per target, and those rolls crit and miss normally. If a feature really does use one shared roll across multiple targets without a template, the content definition should set `canCrit: false, canMiss: false` explicitly on the damage node.

### Weapon proficiency — `ObjectDataModel.weaponType` + `hasWeaponProficiency`

Weapons have an optional `weaponType: string` field (default `''`). If it's empty, the weapon is "permissive" — anyone can crit with it. If it's set (e.g. `'Longsword'`), the attacker must have that string in their `system.proficiencies.weapons` array to be allowed to crit. Minions can never crit regardless. This matches the Nimble rule "no proficiency = no crit."

Content authors can leave `weaponType` blank (nothing breaks) or set it for weapons that require proficiency. Migration014 backfilled existing weapons to `''` so nothing in existing worlds silently stopped critting.

### Advantage/disadvantage sources

`ItemActivationManager.activate()` accepts an optional `rollModeSources: number[]` in addition to the old single-integer `rollMode`. Features that grant or impose adv/dis should push an entry onto this array — everything gets netted before the roll. Backward compatible: if a caller still passes just a single integer, that works too.

## What the engine does NOT do

- **It doesn't render the chat card.** That lives in `src/view/chat/components/` and consumes the finalized roll.
- **It doesn't integrate with Dice So Nice.** DSN visualizes whatever dice are on the roll; the engine has already decided the outcome before DSN sees anything. One current quirk: the vicious explosion path manually rerolls the primary die to avoid DSN preempting the crit chain. Don't touch that without talking to whoever owns DSN integration.
- **It doesn't do targeting.** Target selection is upstream in the activation flow; the engine just receives a target count.
- **It doesn't validate rule compliance.** If you pass it a mixed-type primary pool (`d6 + d8`), it will roll it. The rules say you shouldn't, but the engine doesn't police that — that's on the content layer.

## Where things live

| What you want | Where to look |
|---|---|
| The roll formula preprocessing | `src/dice/DamageRoll.ts` (`_preProcessFormula`, `_applyRollMode`) |
| The primary die logic | `src/dice/terms/PrimaryDie.ts` |
| Tie-aware adv/dis handlers | `src/dice/nimbleDieModifiers.ts` |
| Die modifier metadata (`c`, `cv`, `v`, `n`) | `src/dice/nimbleDieModifiers.ts` (`getNimbleMods()`, `NIMBLE_MODS`) |
| Where custom modifiers get registered | `src/hooks/init.ts` (calls `registerNimbleDieModifiers()`) |
| Roll construction from an item | `src/managers/ItemActivationManager.ts` |
| Weapon proficiency check | `src/view/sheets/components/attackUtils.ts` (`hasWeaponProficiency`) |
| The extension point for post-roll mutations | `DamageRoll._applyPostRollMutations` |
| Test coverage | `src/dice/DamageRoll.test.ts` |
| Developer testbench | `src/view/debug/DiceTestbench.svelte` (gated behind the Debug Mode setting) |

## A worked example end-to-end

A rogue attacks a Distracted goblin with a shortsword (`1d6`), with advantage from flanking and sneak attack (`+2d6`). The weapon has `weaponType: 'Shortsword'` and the rogue is proficient. Not AoE, not minion.

1. **`ItemActivationManager` builds the request:** primary pool `1d6`, bonus dice `2d6` sneak attack, `rollModeSources = [1]` (one advantage source from flanking), target count 1, AoE false, `hasWeaponProficiency` returns true.
2. **Adv sources net:** `+1`. Passed to `DamageRoll`.
3. **`DamageRoll` preprocesses:** primary pool becomes `1d6 + 1 extra` (so `2d6` total, tagged with `khn` modifier to keep 1). Bonus dice `2d6` sit separately as non-primary additive dice.
4. **Foundry rolls:** primary pool `[1, 6]`, sneak attack `[4, 5]`.
5. **`khn` handler runs:** the `1` is marked discarded (leftmost lowest), the `6` is active.
6. **`_evaluate` reads the primary die:** it's the `6`, which is max → crit.
7. **Crit explosion:** reroll the primary die, roll a `4`, add it. Not max, so stop.
8. **`_applyPostRollMutations`:** no-op today. When Vicious Opportunist lands, this is where "set primary die to any value on hit against Distracted target" would run — potentially turning a hit into a crit.
9. **`_finalizeOutcome`:** sets `isCritical = true`, `isMiss = false`. Total: primary `6 + 4` (explosion) + sneak attack `4 + 5` = `19` damage, crit flag set. Chat card renders it all.

### Modifier-mode example: Dravok's Terrible Maw (`4d4cv`)

A Dravok attacks with its Terrible Maw — `4d4cv`, every die can crit independently with vicious explosion.

1. **Formula enters modifier-mode** because `cv` is a Nimble modifier. No PrimaryDie extraction.
2. **Foundry rolls 4d4:** `[4, 2, 4, 1]`. The `cv` handler attaches crit-vicious metadata to the Die term.
3. **Per-die crit check:** dice #1 and #3 rolled max (4 on a d4) → both are crits.
4. **Vicious explosion for die #1:** roll 2d4 → `[3, 2]`. Left die (3) is not max, chain stops. +5 added.
5. **Vicious explosion for die #3:** roll 2d4 → `[4, 1]`. Left die (4) is max → chain continues. Roll 2d4 again → `[2, 3]`. Chain stops. +10 added.
6. **`isCritical = true`** (at least one die critted). Miss detection skipped (no non-neutral die rolled 1 — die #4 rolled 1 but miss reads leftmost die, which rolled 4).
7. **Total:** `4 + 2 + 4 + 1` (base) + `3 + 2` (die #1 explosion) + `4 + 1 + 2 + 3` (die #3 explosion) = `26`.

## Developer testbench

The dice engine has a built-in dev tool for verifying behavior without running through real activations. To enable it:

1. Open **Game Settings → Configure Settings → System Settings**
2. Check **Debug Mode**
3. A new **Open Dice Testbench** button appears below the checkbox

The testbench lets you build arbitrary roll configurations (formula, flags, adv/dis source counts, weapon type, AoE template), pick an actor, and either roll real RNG or force a crit / miss / specific die values. The results panel breaks down each die by category (base pool, dropped, crit reroll, vicious chain, vicious bonus, bonus dice, flat bonuses) so you can see exactly what the engine produced and why.

---

**If this doc gets out of date, prefer updating it over letting it drift.** The rule of thumb: if a content author or teammate can read this doc once and then plug into the engine without reading the engine source, it's doing its job.
