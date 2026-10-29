The Reroll rule lets a creature discard a roll and roll it again. By default the new result stands. **Which roll can it reroll?** picks one or more of Attack, Save, Skill Check and Ability Check. **Who can use it?** picks the side: the one who rolled, the target of the attack, or an ally of the one who rolled. When the roll matches, the feature shows in the **Reroll** menu on the card, for the feature's owner and the GM. The menu shows the cost, and the feature is gone when it has no uses left. See [Anatomy of a chat card](../playing/dice-and-chat.md#anatomy-of-a-chat-card) for what the card shows after a reroll.

**Example: Wily.** Force an enemy to reroll a non-critical attack against you, 1/encounter.

- **Which roll can it reroll?** → `attack`
- **Who can use it?** → `target`
- **The first roll is** → `nonCriticalHit`
- **Attack type** → `any`
- **Charge pool** → `wily`
- **Charges per use** → `1`

The use limit is a Charge Pool rule on the same item, with the identifier `wily`, **Max charges** `1` and a recovery on `encounterEnd`. Each reroll takes one charge from it. When the pool is empty, the feature does not show. Only the first target of an attack can use a target reroll.

**Example: Unstoppable Brutality.** While Raging, you may gain 1 Wound to reroll any attack or save.

- **Which roll can it reroll?** → `attack`, `save`
- **Which saves?** → none picked
- **Who can use it?** → `roller`
- **The first roll is** → `always`
- **Only while** → `{ "self": "raging" }`
- **Wounds gained per use** → `1`

The feature shows only while the condition holds, and its cost reads "1 Wound". The Wound is gained when the player uses the feature.

**Saves and checks.** With Save chosen, **Which saves?** limits the rule to the saves you pick. With Skill Check chosen, **Which skills?** does the same for skills, and with Ability Check chosen, **Which abilities?** does it for abilities. None picked means any. A save or a check has no target, so only the one who rolled can use the rule on it. The rule does not know the DC: the feature shows on every matching roll, and the player decides. The fields for attacks (**The first roll is**, **Attack type**, **Only when the other creature is**, **Only once per attack**, **Add to the Primary Die**, **Extra damage** and the discarded crit) show only when Attack is chosen, and they apply to attacks only.

**Cost** can also spend mana or a heroic reaction. A heroic reaction is spent only in combat, and the player confirms on the click when the combat would normally not let them use it. With the **Costs** toggle off, only the heroic reaction is spent, and the menu shows only that cost.

After a reroll, a feature with uses left stays in the **Reroll** menu of the same card, and its sentence starts with "Reroll again with". Set **Only once per attack** to stop this: the feature then rerolls an attack one time only.

**Changes to the new roll** add to the reroll: one more advantage or disadvantage, a number added to the Primary Die, or extra damage. The new roll keeps the first roll's advantage and disadvantage. A later reroll of the same attack, from any feature, keeps these changes too.

**An ally of the one who rolled.** When a roll is made, the system looks at the tokens on the scene for creatures with an ally reroll. Two player characters are always allies. Other tokens are allies when they have the same disposition, and it is Friendly or Hostile. **Reach** is the most spaces the ally's token can be from the token of the one who rolled; 0 is any distance. The allies and the Reach are checked once, when the roll is made. An ally reroll that a disposition or the Reach kept off the card shows to the GM in one quiet line under the options. The GM can open it and click **Add** to give the ally the feature anyway, for example when a token has the wrong disposition. A creature with no token on the scene gets no ally reroll. An attack with an area has no reroll buttons.

**Which dice does it reroll?** picks **The whole roll** (the default), **The Primary Die**, or **One die the player picks**. A reroll of one die keeps every other die. The roll then keeps the highest or lowest again, and works out the crit, the miss and the total again. A Primary Die that rolls its maximum explodes again. A die below its maximum loses the dice it made explode. With **One die the player picks**, a click on the feature opens the dice, and the player clicks the die to reroll. The player can pick every die that counts, explosion dice too. On a save or a check, the player can also pick the d20 that was dropped for advantage or disadvantage. The changes to the new roll (advantage, a number added to the Primary Die, extra damage) are only for a reroll of the whole roll, so the form shows them only then.

**Which result stands?** picks **The new result** (the default), **The one who rolled keeps one**, or **The owner of this feature keeps one**. When a player keeps a result, the cost is paid and the dice roll, then the card shows a **Keep** button for each result under the reroll line. Until a result is kept, the card keeps the old roll, **Apply Damage** says "Keep a result first", and no other reroll can be used. The cost stays paid when the old result is kept.

**Example: Songweaver's Inspiration.** Allow an ally to reroll a single die of an attack or a save, and they keep either result, 2×WIL times per Safe Rest.

- **Which roll can it reroll?** → `attack`, `save`
- **Who can use it?** → `ally`
- **Reach** → `0`
- **Which dice does it reroll?** → `pickedDie`
- **Which result stands?** → `rollerChooses`
- **Charge pool** → `songweavers-inspiration`

The use limit is a Charge Pool rule with **Max charges** `max(2 * @will, 0)` and a recovery on `safeRest`.

**Example: Optimistic.** Allow an ally within 6 spaces to reroll any single die.

- **Which roll can it reroll?** → `attack`, `save`, `skillCheck`, `abilityCheck`
- **Who can use it?** → `ally`
- **Reach** → `6`
- **Which dice does it reroll?** → `pickedDie`
- **Which result stands?** → `new`
- **Charge pool** → `optimistic`

**Rerolls by itself** is for text with no choice, such as "the attack is rerolled". It does not show for an ally, a picked die, or a choice of result, because a player decides those. The roll is made again at once, with no button. With **Feature Effects** off, a button shows instead. **The discarded crit still triggers when-crit abilities** keeps the crit's triggers when the first roll was a crit: abilities that react to a crit still react, but damage and effects follow the new roll.

**Only when the other creature is** tests the creature on the other side of an attack. For the one who rolled and for an ally, this is the first target. For the target, this is the one who rolled. The test uses the `target:` tags of that creature: one for each condition it has, such as `target:distracted`, and `target:<flag key>` when the owner marked it with a Mark Target rule. The test also sees the owner's own tags, such as `feature:<identifier>`, so one rule can say "a Distracted target, or I have this feature". Empty means any creature. With tags picked, the feature does not show on a roll with no other creature, such as an attack with no target. **Only while** tests the owner, as on other rules. See [The Condition Box](../rules-builder/predicates.md) for the tags.

**Action cost** `1 action` makes a use cost 1 action, for a hero in combat only. On their own turn, the hero spends it at once, and the feature does not show when they have no actions left. Off their turn, their next turn starts with 1 fewer action. It is not a Heroic Reaction, so it has no 1/round limit. Out of combat, nothing is spent. With the **Costs** toggle off, nothing is spent or checked.

**Note on the card** puts a short note under the feature in the menu, such as a limit that the table checks ("Your 2nd miss this round"). **Show the note only when** shows the note only when its tags match, with the same test as **Only when the other creature is**. Empty means on every roll.
