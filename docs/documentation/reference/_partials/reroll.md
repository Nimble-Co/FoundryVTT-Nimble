The Reroll rule lets a creature discard an attack roll and roll it again. The new result stands. **Who can use it?** picks the side: the one who rolled, or the target of the attack. When the attack matches, the attack card shows a **Reroll with** button under the roll for the feature's owner and the GM. The button shows the cost, and it is gone when the feature has no uses left. See [Anatomy of a chat card](../playing/dice-and-chat.md#anatomy-of-a-chat-card) for what the card shows after a reroll.

**Example: Wily.** Force an enemy to reroll a non-critical attack against you, 1/encounter.

- **Which roll can it reroll?** → `attack`
- **Who can use it?** → `target`
- **The first roll is** → `nonCriticalHit`
- **Attack type** → `any`
- **Charge pool** → `wily`
- **Charges per use** → `1`

The use limit is a Charge Pool rule on the same item, with the identifier `wily`, **Max charges** `1` and a recovery on `encounterEnd`. Each reroll takes one charge from it. When the pool is empty, the button does not show. Only the first target of an attack can use a target reroll.

**Example: Unstoppable Brutality.** While Raging, you may gain 1 Wound to reroll any attack.

- **Which roll can it reroll?** → `attack`
- **Who can use it?** → `roller`
- **The first roll is** → `always`
- **Only while** → `{ "self": "raging" }`
- **Wounds gained per use** → `1`

The button shows only while the condition holds, and its cost reads "1 Wound". The Wound is gained when the player clicks the button. The rule covers attacks only, so the save part of the feature stays manual.

**Cost** can also spend mana or a heroic reaction. A heroic reaction is spent only in combat, and the player confirms on the click when the combat would normally not let them use it. With the **Costs** toggle off, only the heroic reaction is spent, and the button shows only that cost.

After a reroll, a feature with uses left shows a **Reroll again** button on the same card. Set **Only once per attack** to stop this: the feature then rerolls an attack one time only.

**Changes to the new roll** add to the reroll: one more advantage or disadvantage, a number added to the Primary Die, or extra damage. The new roll keeps the first roll's advantage and disadvantage.

**Rerolls by itself** is for text with no choice, such as "the attack is rerolled". The attack is rolled again at once, with no button. With **Feature Effects** off, a button shows instead. **The discarded crit still triggers when-crit abilities** keeps the crit's triggers when the first roll was a crit: abilities that react to a crit still react, but damage and effects follow the new roll.
