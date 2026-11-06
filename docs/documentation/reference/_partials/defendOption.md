The Defend Option rule is something the owner can do with a Defend. It shows in the Defend window that opens from the Reactions button on an attack card.

**Shows as** picks the kind:

- **With Defend**: a tick under "When you Defend". It works only with a row that Defends.
- **Free Defend**: a row of its own that Defends with no action. It still uses the Defend for the round. **Use this item** casts the item (a spell pays its own mana and action); **More armor per upcast** adds armor for each step the player upcasts it. **Only when you Interpose** shows the row only as Interpose and Defend.
- **Second Defend**: the owner can Defend one more time in a round, until their next turn begins.
- **When an Ally Defends**: a button on the card for the owner after an ally within **Range** Defends. **Range** is a formula, so `@auraReach` follows the owner's aura.

**Damage** sets what the Defend does to the damage: the attack misses or no damage (the owner takes none), or half the damage in place of the Armor (rounds up). **More armor** adds a formula to the Armor. With several options on one Defend, the order is fixed: a miss or no damage, then half or the Armor, then the rest.

**Use this item's reroll** rerolls the attack with the Reroll rule of the same item, after the Defend. That Reroll rule then shows only in the Defend window, not under Change This Roll. **Condition on the attacker** puts a condition on the attacker. **Reminder** is a line on the card for what the table does, such as a move or an attack back. **Every attack this round** makes the Defend cover each later attack on the owner until their next turn, with nothing more to spend.

**Only when the attacker is** tests the creature that made the attack. It sees the attacker's `target:` tags and the marks the owner put on it, so `target:quarry` means "against my quarry".

The cost (charges, actions, mana, Wounds, and **Expend a dice pool**) is spent when the player confirms. **Expend a dice pool** expends every die of that pool and needs at least one die. **Undo** on the target row gives it back.

**Example: Pocket Sand.** When you Defend against a melee attack, Blind the attacker and force them to reroll the attack.

- A **Reroll** rule for the reroll with disadvantage and its charges
- A **Defend Option** rule: **Shows as** → `With Defend`, **Attacks** → `Melee`, **Use this item's reroll** → on, **Condition on the attacker** → `Blinded`

**Example: Exploit.** Reaction (whenever an ally within your aura Defends), you may expend your Judgment Dice to force an enemy within your aura to Interpose.

- A **Defend Option** rule: **Shows as** → `When an Ally Defends`, **Range** → `@auraReach`, **Expend a dice pool** → `judgment`, **Actions** → `1`, and a **Reminder** for the Interpose the table moves.
