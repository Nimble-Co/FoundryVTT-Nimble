The Change a Result rule lets a creature change the result of a save, a skill check or an ability check after it is made. **How does it change the result?** picks one of three:

- **It succeeds:** the card says Succeeded, and the total stays. The row goes away while the change stands. Other rows stay.
- **Set the total to a formula:** the total on the card becomes the formula's value. **Only if the total is lower** shows the row only when the total on the card is below that value. With it off, the row shows at any total but that value, since a click there changes nothing.
- **Add a formula to the total:** the formula's value goes on the total. The row stays, so the player can use it again while they can pay. A negative value lowers the total.

**Formula** is read from the one who rolled, also when an ally uses the rule. Use the stat names, such as `@strength`, `@dexterity`, `@intelligence` and `@will`. A formula that is only one stat shows that stat on the row, such as **Add +3 STR**. Other formulas show the number only.

The row shows on each check the rule covers, also when the card knows no DC, because the system cannot tell if the roll failed. A check has no target, so **The target** gives no row. The other fields work as on the [Reroll](#reroll) rule: **Who can use it?**, **Reach**, **Only while**, the cost fields and **Note on the card**.

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

**What the change does to the card.** The roll stays what the dice gave. The card keeps the changes in order and works out its total from them. A known DC is read again after each change. A natural 1 or 20 still counts through an add, but not through a set total, which replaces the roll. The player and the GM can take a change back with **Remove**: the uses, Mana and Wounds it cost go back. An action or a Heroic Reaction stays spent. A reroll takes the changes off the card, and their cost stays paid. A change of a die keeps them. See [Changing a result](../playing/dice-and-chat.md#changing-a-result) for what the player sees.
