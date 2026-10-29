The Primary Die Bonus rule adds a number to the Primary Die of the owner's own attack rolls. It works as "Add to Primary Die Result" in the attack roll window, and it adds to the number the player types there. The die stops at its max and at 1. When the sum goes past the max, the die counts as its max (a crit, if the attack can crit), and the remainder is added to the damage. A reroll keeps the bonus. An area attack does not get it.

**Example: Unerring Judgment.** Increase your Primary Die rolls on melee attacks by 1 whenever you have Judgment Dice.

- **Label** → `Unerring Judgment`
- **Add to the Primary Die** → `1`
- **Attack type** → `melee`
- **Only while** → `self:pool:judgment`

The `self:pool:judgment` tag is there while the Judgment Dice pool has at least 1 die, so the bonus stops when the pool is empty.

**Only when the target is** tests the first target of the attack, with the same `target:` tags as on the Reroll rule, for example `target:distracted`. Empty means any target. With tags picked, an attack with no target gets no bonus.

The card shows one line at the roll for each bonus, with the rule's **Label** (or the item name when the label is empty) and a tag such as **+1 Primary Die**. Several bonuses add up. A Change a Die rule that sets the die drops the bonus, and the card says so.
