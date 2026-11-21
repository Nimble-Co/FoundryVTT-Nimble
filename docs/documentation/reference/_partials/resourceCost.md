**Example: Storm Wake.** Each use spends 3 mana.

- **Resource** → `Mana`
- **Spend mode** → `Fixed`
- **Amount** → `3`

The rule goes on the item whose use has the cost. An item can have more than one, such as 2 mana and 5 HP. The system checks every cost before the roll. When the creature does not have enough, the use stops with a message such as "Storm Wake needs 3 mana. You have 2.", and nothing is rolled or spent.

What each resource needs:

- **Mana**: at least the amount.
- **Temp HP**: at least the amount. Only temp HP is spent, never HP.
- **HP**: more than the amount, so the creature keeps at least 1 HP. A sacrifice of HP is not damage: armor, damage triggers and Concentration checks do not apply.
- **Wounds**: room for every Wound below the maximum.

**Using Beyond What You Have** sets what happens when a use needs more than the creature has:

- **Not Allowed** (the default): the use stops with the "needs" message.
- **Allowed**: the player is asked first, such as "You have 1 mana. Stretch Time needs 2. Use it anyway?" On **Use Anyway**, the creature spends or sacrifices what it has. Mana, temp HP and HP go down to 0, never below. Every Wound applies, even past the maximum, and the normal death rules follow. On **Cancel**, the use stops and nothing is spent.
- **Half Max HP Damage**: as Allowed, and the creature also takes damage equal to half its max HP. The consequences are the same as for Casting Beyond the Pool on a class.

The card shows what the use took, so a creature with 1 mana shows **Cost: 1 mana (Stretch Time)**.

The roll window says what the use costs, such as "When you roll, it spends 2 Mana and you sacrifice 5 HP."

The **Amount** can be a number, a formula such as `@level`, or a roll such as `1d4`. A roll is rolled at each use, and the check uses its lowest result. The card shows the result and the roll: **Cost: 3 Wounds (1d4, Enveloped by the Master)**.

**Example: Supercharge.** Spend 1 mana or more, up to your WIL.

- **Resource** → `Mana`
- **Spend mode** → `Variable`
- **Minimum** → `1`
- **Maximum** → `@will`

The roll window asks for the amount. It starts at the minimum and stops at the maximum or at what the creature has, whichever is lower.

The item's damage and healing formulas read what the use spends or sacrifices as `@cost.mana`, `@cost.hp`, `@cost.tempHp` and `@cost.wounds`. `(@cost.mana)d8` rolls 1d8 for each mana spent. `@spent` stays the charges of a Charge Consumer.

::: details Edge cases
- With Not Allowed, a rolled amount that comes up higher than the creature can cover stops the use with the "needs" message, and nothing is spent. With any other choice, the player is asked after the roll, and the use takes what the creature has.
- A variable amount still stops at what the creature has. Only a minimum above it asks to use beyond what the creature has.
- The consequence applies after the item's own cost, such as a spell's mana. When that cost stops the use, there is no consequence.
- A variable HP amount stops at current HP minus 1. The use stops before the roll window opens when the creature cannot cover the minimum.
- With the **Costs** automation setting off, nothing is checked or spent. A variable cost still asks for the amount, a roll is still rolled, the formulas still read the amount, and the card still shows the cost lines.
:::
