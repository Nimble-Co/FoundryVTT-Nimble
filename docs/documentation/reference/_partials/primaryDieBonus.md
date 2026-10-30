The Primary Die Bonus rule adds a number to the Primary Die of the owner's own attack rolls. It works as "Add to Primary Die Result" in the attack roll window, and it adds to the number the player types there. The number changes the face of the die itself, from 1 up to its max, so the die can become a crit (and explode) or stop being a miss. The part past the max is lost: a d6 that rolls 6 with +1 stays 6. A reroll keeps the number. A value that a Change a Die rule sets gets it only when that rule has **Add the Primary Die bonus to the set value** on. An area attack does not get it.

**Example: Unerring Judgment.** Increase your Primary Die rolls on melee attacks by 1 whenever you have Judgment Dice.

- **Label** → `Unerring Judgment`
- **Add to the Primary Die** → `1`
- **Attack type** → `melee`
- **Only while** → `self:pool:judgment`

The `self:pool:judgment` tag is there while the Judgment Dice pool has at least 1 die, so the bonus stops when the pool is empty.

**Only when the target is** tests the first target of the attack, with the same `target:` tags as on the Reroll rule, for example `target:distracted`. Empty means any target. With tags picked, an attack with no target gets no bonus.

The card shows one line at the roll for each bonus, with the rule's **Label** (or the item name when the label is empty) and a tag such as **+1 to Primary Die**. Several bonuses add up.
