The Reroll rule lets a creature discard a roll and roll it again. By default the new result stands. **Which roll can it reroll?** picks one or more of Attack, Save, Skill Check and Ability Check. **Who can use it?** picks the side: the one who rolled, the target of the attack, or an ally of the one who rolled. When the roll matches, the card shows a **Reroll with** button for the feature's owner and the GM. The button shows the cost, and it is gone when the feature has no uses left. See [Anatomy of a chat card](../playing/dice-and-chat.md#anatomy-of-a-chat-card) for what the card shows after a reroll.

**Example: Wily.** Force an enemy to reroll a non-critical attack against you, 1/encounter.

- **Which roll can it reroll?** → `attack`
- **Who can use it?** → `target`
- **The first roll is** → `nonCriticalHit`
- **Attack type** → `any`
- **Charge pool** → `wily`
- **Charges per use** → `1`

The use limit is a Charge Pool rule on the same item, with the identifier `wily`, **Max charges** `1` and a recovery on `encounterEnd`. Each reroll takes one charge from it. When the pool is empty, the button does not show. Only the first target of an attack can use a target reroll.

**Example: Unstoppable Brutality.** While Raging, you may gain 1 Wound to reroll any attack or save.

- **Which roll can it reroll?** → `attack`, `save`
- **Which saves?** → none picked
- **Who can use it?** → `roller`
- **The first roll is** → `always`
- **Only while** → `{ "self": "raging" }`
- **Wounds gained per use** → `1`

The button shows only while the condition holds, and its cost reads "1 Wound". The Wound is gained when the player clicks the button.

**Saves and checks.** With Save chosen, **Which saves?** limits the rule to the saves you pick. With Skill Check chosen, **Which skills?** does the same for skills, and with Ability Check chosen, **Which abilities?** does it for abilities. None picked means any. A save or a check has no target, so only the one who rolled can use the rule on it. The rule does not know the DC: the button shows on every matching roll, and the player decides. The fields for attacks (**The first roll is**, **Attack type**, **Only once per attack**, **Add to the Primary Die**, **Extra damage** and the discarded crit) show only when Attack is chosen, and they apply to attacks only.

**Cost** can also spend mana or a heroic reaction. A heroic reaction is spent only in combat, and the player confirms on the click when the combat would normally not let them use it. With the **Costs** toggle off, only the heroic reaction is spent, and the button shows only that cost.

After a reroll, a feature with uses left shows a **Reroll again** button on the same card. Set **Only once per attack** to stop this: the feature then rerolls an attack one time only.

**Changes to the new roll** add to the reroll: one more advantage or disadvantage, a number added to the Primary Die, or extra damage. The new roll keeps the first roll's advantage and disadvantage. A later reroll of the same attack, from any feature, keeps these changes too.

**An ally of the one who rolled.** When a roll is made, the system looks at the tokens on the scene for creatures with an ally reroll. Two player characters are always allies. Other tokens are allies when they have the same disposition, and it is Friendly or Hostile. **Range** is the most spaces the ally's token can be from the token of the one who rolled; 0 is any distance. The allies and the range are checked once, when the roll is made. An ally reroll that a disposition or the range kept off the card shows to the GM in one quiet line under the options. The GM can open it and click **Add** to give the ally the button anyway, for example when a token has the wrong disposition. A creature with no token on the scene gets no ally reroll. An attack with an area has no reroll buttons.

**Which dice does it reroll?** picks **The whole roll** (the default), **The Primary Die**, or **One die the player picks**. A reroll of one die keeps every other die. The roll then keeps the highest or lowest again, and works out the crit, the miss and the total again. A Primary Die that rolls its maximum explodes again. A die below its maximum loses the dice it made explode. With **One die the player picks**, the button opens the dice in its place, and the player clicks the die to reroll. The player can pick every die that counts, explosion dice too. On a save or a check, the player can also pick the d20 that was dropped for advantage or disadvantage. The changes to the new roll (advantage, a number added to the Primary Die, extra damage) are only for a reroll of the whole roll, so the form shows them only then.

**Which result stands?** picks **The new result** (the default), **The one who rolled chooses**, or **The owner of this feature chooses**. With a choice, the cost is paid and the dice roll, then the card shows a **Keep** button for each result under the reroll line. Until a result is kept, the card keeps the old roll, **Apply Damage** says "Keep a result first", and no other reroll can be used. The cost stays paid when the old result is kept.

**Example: Songweaver's Inspiration.** Allow an ally to reroll a single die of an attack or a save, and they keep either result, 2×WIL times per Safe Rest.

- **Which roll can it reroll?** → `attack`, `save`
- **Who can use it?** → `ally`
- **Range** → `0`
- **Which dice does it reroll?** → `pickedDie`
- **Which result stands?** → `rollerChooses`
- **Charge pool** → `songweavers-inspiration`

The use limit is a Charge Pool rule with **Max charges** `max(2 * @will, 0)` and a recovery on `safeRest`.

**Example: Optimistic.** Allow an ally within 6 spaces to reroll any single die.

- **Which roll can it reroll?** → `attack`, `save`, `skillCheck`, `abilityCheck`
- **Who can use it?** → `ally`
- **Range** → `6`
- **Which dice does it reroll?** → `pickedDie`
- **Which result stands?** → `new`
- **Charge pool** → `optimistic`

**Rerolls by itself** is for text with no choice, such as "the attack is rerolled". It does not show for an ally, a picked die, or a choice of result, because a player decides those. The roll is made again at once, with no button. With **Feature Effects** off, a button shows instead. **The discarded crit still triggers when-crit abilities** keeps the crit's triggers when the first roll was a crit: abilities that react to a crit still react, but damage and effects follow the new roll.
