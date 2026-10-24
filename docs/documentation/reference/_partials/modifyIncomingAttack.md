**Example: Parry.** Attacks against the creature miss on a 1 and a 2.

- **Label** → `Parry`
- **Modifier** → `raiseMissThreshold`
- **Miss threshold** → `2`

This rule changes attacks made *against* the character carrying the item. It is consulted when the attack is rolled, not during data preparation, so positional predicates like `alliesAdjacent` are checked with fresh positions.

The **Modifier** picks what happens:

- `disadvantage` gives the attack one level of disadvantage. Two matching rules give two levels. Advantage and disadvantage cancel one for one.
- `autoMiss` turns the attack into a miss, even against attackers who normally cannot miss.
- `redirectToSelf` offers an Interpose: when an ally within **Range (spaces)** is attacked, this character may swap in as the target.
- `raiseMissThreshold` raises the primary die result that counts as a miss to **Miss threshold**. This is the bandit Parry trait: set it to `2` and attacks against the character miss on a 1 and a 2.

`disadvantage`, `autoMiss`, and `raiseMissThreshold` apply on their own. `redirectToSelf` shows a button on the attack card that only the reacting player (or the GM) can use.

To make an attacker reroll an attack against the character, use the [Reroll](./rules-triggers.md#reroll) rule with **Who can use it?** set to `target`.

**Raise Miss Threshold** is an absolute value, not an amount added to the default of 1. Several sources do not stack: the highest threshold wins, so two Parry traits still miss only on a 1 and a 2. A primary die that rolls its maximum face is a critical hit and never a miss, and an attacker who cannot miss is not subject to the threshold at all.

**Redirect to Self** covers an ally within **Range** spaces (2 by default). Every living allied character is already offered the baseline Interpose within 2 spaces without any rule; use this modifier for feature versions that reach further or that let a non-character (such as an animal companion) step in. Using an Interpose swaps the attack card's target to the protector, so armor and damage reduction are resolved against them when damage is applied. Moving the token into place stays manual.

Gate any modifier with the rule's **Predicate**, for example `self: dying` so a modifier only applies while the character is Dying. Only the first target of an attack is checked, and area attacks are left alone so one target's defense does not change a roll shared by everyone.
