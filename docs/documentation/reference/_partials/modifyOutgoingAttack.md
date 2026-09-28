**Example: Swallowed.** While a creature is inside the Great Worm, every attack it makes lands and ignores armor.

- **Label** → `Swallowed: attacks cannot miss`
- **Modifier** → `cannotMiss`
- **Predicate** → `$and: ["self:condition:swallowed"]`

This rule changes attacks made *by* the character carrying the item. It is consulted when the attack is rolled, not during data preparation, so a predicate on volatile state (holding a condition, adjacency) is checked against fresh values.

The **Modifier** picks what happens:

- `cannotMiss` turns the attack roll's miss check off entirely. A natural 1 lands, and no miss threshold is consulted.
- `ignoreArmor` makes the attack's damage bypass the target's armor.

One rule sets one modifier, so an effect that does both needs two rules.

`cannotMiss` only touches attack rolls. A saving throw against the attack resolves exactly as it would otherwise: succeeding the save still avoids a save-gated effect. A target's own `autoMiss` (see **Modify Incoming Attack**) also still wins, turning the attack into a miss even against an attacker who cannot miss.

Gate either modifier with the rule's **Predicate**. `self:condition:<id>` is the usual one — every condition an actor currently has emits that tag, so `self:condition:swallowed` limits the rule to while the condition is held.
