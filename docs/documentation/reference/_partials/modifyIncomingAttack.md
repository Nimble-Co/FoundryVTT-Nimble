**Example: Pocket Sand.** A trick that lets the target force an attacker to reroll, at disadvantage.

- **Label** → `Pocket Sand`
- **Modifier** → `forceReroll`
- **Reroll when** → `always`
- **Reroll at disadvantage** → checked

This rule changes attacks made *against* the character carrying the item. It is consulted when the attack is rolled, not during data preparation, so positional predicates like `alliesAdjacent` are checked with fresh positions.

The **Modifier** picks what happens:

- `disadvantage` gives the attack one level of disadvantage. Two matching rules give two levels. Advantage and disadvantage cancel one for one.
- `autoMiss` turns the attack into a miss, even against attackers who normally cannot miss.
- `forceReroll` offers a button on the attack card to discard the roll and roll again; the second result stands.
- `redirectToSelf` offers an Interpose: when an ally within **Range (spaces)** is attacked, this character may swap in as the target.

`disadvantage` and `autoMiss` apply on their own. `forceReroll` and `redirectToSelf` show a button on the attack card that only the reacting player (or the GM) can use.

**Force Reroll** has three extra options. Check **Automatic** to reroll the moment the attack resolves with no button, for rerolls that are not optional (for example, rerolling an incoming critical hit). **Reroll when** limits it to `always`, only on a `hit` (not a miss), or only on a `criticalHit`. Check **Reroll at disadvantage** to make the reroll itself roll at disadvantage.

**Redirect to Self** covers an ally within **Range** spaces (2 by default). Every living allied character is already offered the baseline Interpose within 2 spaces without any rule; use this modifier for feature versions that reach further or that let a non-character (such as an animal companion) step in. Using an Interpose swaps the attack card's target to the protector, so armor and damage reduction are resolved against them when damage is applied. Moving the token into place stays manual.

Gate any modifier with the rule's **Predicate**, for example `self: dying` so a reroll only applies while the character is Dying. Only the first target of an attack is checked, and area attacks are left alone so one target's defense does not change a roll shared by everyone.
