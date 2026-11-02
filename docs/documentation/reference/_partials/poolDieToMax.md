The Pool Die To Max rule sets the lowest dice of a dice pool to their max when its trigger fires. `onAttacked` raises one die each time the hero takes damage from an attack, after the refills of that attack. `onWound` raises one die per Wound. With a **Reach for allies**, it also fires when an ally within that reach gets Wounds.

**Example: Avenger.** Change Judgment Dice to their max when you or an ally near you gets Wounds.

- **Pool** → `judgment`
- **Trigger** → `onWound`
- **Reach for allies** → `4`

A Free Move rule with the trigger `afterPoolDiceToMax`, on the same item, arms after the dice change.
