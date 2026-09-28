**Example: Swallowed.** A creature inside the Great Worm takes 20 damage every turn until it gets out.

- **Label** → `Swallowed: 20 damage at the start of your turn`
- **Damage** → `20`
- **When** → `turnStart`
- **Predicate** → `$and: ["self:condition:swallowed"]`

The damage lands on the actor carrying the item, not on anyone they are fighting. It fires once per turn, at the start or the end, and only in combat: outside an encounter there are no turns to fire on.

**Damage** takes a flat number, a formula (`@level`), or dice (`2d6+1`). The roll is posted to chat with the rule's label before it is applied, so the table can see where the damage came from. A roll that comes out at 0 is skipped entirely.

Gate it with the rule's **Predicate** when the damage should only apply some of the time, most often `self:condition:<id>` so it runs while a condition is held and stops when it ends.
