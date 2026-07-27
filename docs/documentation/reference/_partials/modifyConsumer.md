**Example: Stone's Resilience.** A subclass feature that improves how another feature spends Fury Dice.

- **Label** → `Stone's Resilience`
- **Pool identifier** → `fury`
- **Pool scope** → `item`
- **Effect type filter** → `damageReduction`
- **Append formula** → `@sum`

Modify Consumer edits the effect formula of Dice Consumer rules that target a pool, without touching the feature those consumers live on. It is the consumer counterpart of Modify Pool: use it when a later feature makes an earlier spend better.

**Pool scope** must match the pool you are aiming at, the same way a Dice Consumer's does. Identifiers are only unique within a scope, so an item-scoped `fury` and an actor-scoped `fury` are different pools, and a modifier set to the wrong scope simply does nothing.

The append is added to the matching formula as a sum, so a consumer reducing damage by `(@strength + @dexterity) * @n` becomes `(@strength + @dexterity) * @n + (@sum)`. The same references are available as in the consumer itself: `@n` for the number of dice spent and `@sum` for their total.

**Effect type filter** narrows which consumers are touched. Left blank it modifies every consumer on the pool; set to `damageReduction` it only improves spends that soak damage, leaving other features that spend from the same pool alone. That distinction matters on a shared pool, where one feature spends for damage reduction and another for movement.

If several Modify Consumer rules match, each one appends in rule **Priority** order. The rule's **Predicate** gates it in the usual way.
