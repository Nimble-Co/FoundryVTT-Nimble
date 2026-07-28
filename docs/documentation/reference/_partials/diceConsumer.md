**Example: That all you got?!** A reaction that spends Fury Dice to soak damage.

- **Label** → `That all you got?!`
- **Pool identifier** → `fury`
- **Mode** → `manual`
- **Cost** → `1`
- **Effect formula** → `(@strength + @dexterity) * @n`
- **Effect type** → `damageReduction`
- **Selection outcome** → `consume`

A consumer is what makes a dice pool do something. The pool stores the dice; the consumer decides how they are used.

**Mode** picks between the two shapes:

- `manual` puts the player in charge. Activating the item opens the dice panel on their sheet with this feature already selected, they pick which dice to use, and confirming applies the result. Use this for anything the rules text describes as a choice.
- `autoBonus` is passive: every face in the pool is added to qualifying attacks automatically and nothing is spent. **Attack delivery** narrows it to `melee`, `ranged`, or `any`. This is how a pool that snowballs damage works.

Several consumers can share one pool. A Berserker's Fury Dice carry an `autoBonus` consumer for melee damage *and* separate `manual` consumers for the features that spend them, all pointing at the same `fury` identifier.

**Effect formula** is evaluated when the player confirms, with two references filled in from their picks: `@n` is how many dice they chose and `@sum` is the total of those dice faces. **Effect type** decides what the result does: `generic` posts the total to chat and leaves the rest to the table, while `damageReduction` also banks the total so it is subtracted from the next damage the character takes.

**Selection outcome** decides what happens to the dice the player picked:

- `consume` removes them from the pool. This is the normal case, and it needs an effect formula to be worth showing.
- `maximize` leaves them in the pool and raises each one to the die's highest face. Use it for a feature that changes a die rather than spending it. No effect formula is needed, dice already showing their highest face are not offered, and the number of picks is limited by **Cost**, so a cost of `1` gives the player exactly one choice.
