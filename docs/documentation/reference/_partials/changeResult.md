The Change a Result rule lets a creature change the result of a roll after it is made. **How does it change the result?** picks one of five. The first three are for a save, a skill check, an ability check or Initiative:

- **It succeeds:** the card says Succeeded, and the total stays. The row goes away while the change stands. Other rows stay.
- **Set the total to a formula:** the total on the card becomes the formula's value. **Only if the total is lower** shows the row only when the total on the card is below that value. With it off, the row shows at any total but that value, since a click there changes nothing.
- **Add a formula to the total:** the formula's value goes on the total. The row stays, so the player can use it again while they can pay. A negative value lowers the total.

The last two have their own rolls:

- **The target takes no damage:** for an attack, used by its target. See [No damage](#no-damage) below.
- **A result of 1 or less counts as a natural 20:** for a save or a skill check. See [Counts as a natural 20](#counts-as-a-natural-20) below.

**The first roll is** shows for **It succeeds** and **Add a formula**. **A failed roll**, the default, hides the row while the card says Succeeded. **Any result** always shows the row. A set total does not read this field, because "set your skill check to 10" is not only for a failure.

**Related to a stat** limits the rule to one stat, as on the [Reroll](#reroll) rule.

**Formula** is read from the one who rolled, also when an ally uses the rule. Use the stat names, such as `@strength`, `@dexterity`, `@intelligence` and `@will`. A formula that is only one stat shows that stat on the row, such as **Add +3 STR**. Other formulas show the number only.

The row shows on each check the rule covers, also when the card knows no DC, because the system cannot tell if the roll failed. A check has no target, so **The target** gives no row there. The other fields work as on the [Reroll](#reroll) rule: **Who can use it?**, **Reach**, **Only while**, the cost fields and **Note on the card**.

**Example: Mighty Soul.** Whenever you would fail a saving throw, you may gain a Wound in order to add your STR to the result you rolled. You may repeat this any number of times.

- **Which roll can it change?** → `save`
- **Who can use it?** → `roller`
- **How does it change the result?** → `add`
- **Formula** → `@strength`
- **Wound cost** → `1`

**Example: a feature that changes a skill check to 10+INT, 1/day.**

- **Which roll can it change?** → `skillCheck`
- **Who can use it?** → `roller`
- **How does it change the result?** → `setTotal`
- **Formula** → `10+@intelligence`
- **Charge pool** → the pool of the feature

**Example: a feature that changes Initiative to 10 when it is lower.**

- **Which roll can it change?** → `initiative`
- **Who can use it?** → `roller`
- **How does it change the result?** → `setTotal`
- **Formula** → `10`
- **Only if the total is lower** → on

**On Initiative.** Initiative has no result, so **It succeeds** gives no row there. A set total or an add also changes the combatant's Initiative and starting actions. The Reroll and Change a Die rules do not work on Initiative. See [The Initiative card](../playing/dice-and-chat.md#the-initiative-card).

**What the change does to the card.** The roll stays what the dice gave. The card keeps the changes in order and works out its total from them. A known DC is read again after each change. A natural 1 or 20 still counts through an add, but not through a set total, which replaces the roll. The player and the GM can take a change back with **Remove**: the uses, Mana and Wounds it cost go back. An action or a Heroic Reaction stays spent. A reroll takes the changes off the card, and their cost stays paid. A change of a die keeps them. See [Changing a result](../playing/dice-and-chat.md#changing-a-result) for what the player sees.

### No damage

**Example: Epic Resistance.** Take no damage from one attack, a number of times per day.

- **Which roll can it change?** → `attack`
- **Who can use it?** → `target`
- **How does it change the result?** → `noDamage`
- **Charge pool** → the pool of the feature

On a hit, the row **No Damage** shows for the owner of the target and the GM. This rule also shows on an attack with more than one target and on an area attack, one row for each target that has it. A click covers that target only: at **Apply Damage**, it takes no damage from any packet of this attack, and the other targets take their damage. A damage reduction that the target has banked stays for a later attack. The target's row on the card shows a **No Damage** tag.

The history line says **No Damage for** the target **with** the feature. **Remove** gives the cost back until the damage is applied. After that, the line has no **Remove**, and the row does not show. A reroll does not take the change off.

### Counts as a natural 20

**Example: a feature that treats a very low STR roll as a natural 20.**

- **Which roll can it change?** → `save`, `skillCheck`
- **Who can use it?** → `roller`
- **How does it change the result?** → `countsAsNat20`
- **Related to a stat** → `strength`

When the total is 1 or less, the d20 counts as a 20. The new total is 20 plus the modifier of the roll, and the save or check succeeds. It happens by itself and costs nothing, when the card is posted and again after a reroll. The dice on the card do not change. The sum box says **Rolled 1, counts as 20 − 1 = 19**. The history line says **Counts as a Natural 20** with the feature, and it has no **Remove**.

With **Feature Effects** off, the rule shows as a row, **Count as a Natural 20**, and the player clicks it. A row pays the cost fields of the rule, when it has any, and it has a **Remove**.

