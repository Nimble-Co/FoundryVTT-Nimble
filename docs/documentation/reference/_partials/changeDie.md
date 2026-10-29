The Change a Die rule lets a creature put a new value on one die of a roll that was already made. No die is rolled again. **Which die does it change?** picks **The Primary Die** or **One die the player picks**. On a save or a check, the Primary Die is the d20. **How does it change the die?** picks **Set it to a value the player picks** or **Add a number**. The feature shows in the **Change die** menu on an attack card, and under **Change a die** in the menu of a save or check card. See [Changing a die](../playing/dice-and-chat.md#changing-a-die) for what the player sees.

The other fields work as on the [Reroll](#reroll) rule: **Who can use it?**, **The first roll is**, **Attack type**, **Only while**, **Only when the other creature is**, the cost fields, **Only once per attack** and **Note on the card**.

**Example: Vicious Opportunist.** 1/turn, when you hit a Distracted target with a melee attack, you may change the Primary Die roll to whatever you like.

- **Which roll can it change?** → `attack`
- **Who can use it?** → `roller`
- **Which die does it change?** → `primaryDie`
- **How does it change the die?** → `set`
- **The first roll is** → `hit`
- **Attack type** → `melee`
- **Only when the other creature is** → `{ "$or": ["target:distracted", "target:exploit-weakness", "feature:supreme-execution"] }`
- **Charge pool** → `vicious-opportunist`

The use limit is a Charge Pool rule with **Max charges** `1` and recoveries on `onTurnStart` and `encounterEnd`. The test passes when the target is Distracted, when the owner marked the target with Exploit Weakness, or when the owner has the feature Supreme Execution. The item also has **Note on the card** `If the target is not Distracted, attack with a blade (Supreme Execution)`, with **Show the note only when** `feature:supreme-execution`. The system does not know if the weapon is a blade, so the note tells the player to check.

**Example: THAT'S Not What Happened!** 1/Safe Rest, Action: after a Distracted enemy attacks you, you may change the Primary Die roll to whatever you like.

- **Which roll can it change?** → `attack`
- **Who can use it?** → `target`
- **Which die does it change?** → `primaryDie`
- **How does it change the die?** → `set`
- **The first roll is** → `hit`
- **Only when the other creature is** → `target:distracted`
- **Charge pool** → `thats-not-what-happened`
- **Action cost** → `1 action`

For the target, the other creature is the one who rolled. The test still uses `target:` tags, so `target:distracted` means "the attacker is Distracted".

**A set value is final.** The player picks the value from 1 to the die's max. A number from "Add to Primary Die Result" or from a Primary Die Bonus rule is not added to it, and the card shows how much was not added. **Add a number** uses **Number to add**: the number is added to the face that the die shows, and a negative number takes away. The die stays between 1 and its max.

**What the change does to the roll.** A kept die stays kept and a dropped die stays dropped: advantage and disadvantage are not worked out again. The crit, the miss and the total are worked out again. A Primary Die at its max explodes, and the new explosion dice are rolled. A max that goes away loses its explosion dice. The card then follows the new result as after a reroll. Modify Reroll rules do not apply to a change.
