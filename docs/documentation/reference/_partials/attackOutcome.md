The Attack Outcome rule changes how an attack roll is read when it is made. There is no choice and no button. **Which attacks does it change?** picks **Your attacks** or **Attacks against you**.

**What changes?** has four fields, and one rule can use any of them:

- **The attack cannot miss.** A 1 on the Primary Die is a hit. The card shows the tag "Cannot miss: Slashing" when the die shows a miss face.
- **Crit on this many less than the max.** With 1, a d8 crits on a 7 or 8. Only the face that the Primary Die keeps counts. The extra dice of a crit still roll again only on the max.
- **Make the attack a crit.** **Always, also on a 1** is a crit on any face, and it stays for the card. **On a hit** leaves a miss a miss, and it is worked out again after a reroll or a change. The die keeps its face, and the crit rolls it one more time.
- **Any die at its max is a crit.** Any die of the roll at its max makes the attack a crit on a hit.

**On which attacks?** limits the rule to an **Attack type** and to **Only attacks with this item**. **Only while** tests the owner. To test the damage type of the attack, use `attack:damageType:slashing`. **Only when the other creature is** tests the target, or the one who attacks for **Attacks against you**. A rule with that field set does not run on an attack with 2 or more targets.

**Charge pool** limits your own attacks: the rule spends 1 charge by itself each time it changes an attack, and it does not run when the pool is empty.

When several rules apply, any "cannot miss" wins, the largest crit range wins, and an "always" crit beats one on a hit. An attack with 2 or more targets, an area attack and a roll that cannot crit take no crit change. A target's forced miss beats every crit from this rule.

With **Feature Effects** off, "cannot miss" and the crit range still apply. A rule that gives a crit becomes a **Make crit** button on the card.

**Example: Deathbringer's Touch.** Your first melee attack each round against a Bloodied creature is an automatic critical hit.

- **Make the attack a crit** → `Always, also on a 1`
- **Attack type** → `melee`
- **Only when the other creature is** → `target:bloodied`
- **Charge pool** → `deathbringers-touch`

The use limit is a Charge Pool rule with **Max charges** `1` and recoveries on `onTurnStart` and `encounterEnd`.

**Example: Slashing.** Your attacks with slashing weapons cannot miss unarmored enemies.

- **The attack cannot miss** → on
- **Only while** → `attack:damageType:slashing`
- **Only when the other creature is** → `target:armor:none`

**Source** limits the rule to weapon or spell attacks. An attack with no item counts as a weapon attack. **Not attacks with this item** takes an item identifier: the rule ignores attacks with that item.
