The Pool Die To Max rule sets the lowest dice of a dice pool to their max when its trigger fires. `onAttacked` raises one die each time an attack targets the hero, on a hit or a miss, after the refills of that attack. Damage from a card that does not target the hero also counts as an attack. One attack raises only one die: a reroll or the damage of the same card does not raise one more. `onWound` raises one die per Wound. With a **Reach for allies**, it also fires when an ally within that reach gets Wounds. The reach is a formula, so `@auraReach` follows the size of the hero's aura.

**Example: Avenger.** Change Judgment Dice to their max when you or an ally within your aura gets Wounds.

- **Pool** → `judgment`
- **Trigger** → `onWound`
- **Reach for allies** → `@auraReach`

A Free Move rule with the trigger `afterPoolDiceToMax`, on the same item, arms after an `onWound` change. `onAttacked` does not arm it.

With **Feature Effects** off, no die changes. `onWound` still arms the Free Move.
