**Example: Storm Wake.** Each use spends 3 mana.

- **Resource** → `Mana`
- **Spend mode** → `Fixed`
- **Amount** → `3`

Put the rule on the item whose use has the cost. An item can have more than one cost. The system checks every cost before the roll. When the creature does not have enough, the use stops with a message, and nothing is rolled or spent.

What each resource needs:

- **Mana** and **Temp HP**: at least the amount.
- **HP**: more than the amount, so the creature keeps 1 HP.
- **Wounds**: room for every Wound below the maximum.

**Using Beyond What You Have** sets what happens when a use needs more than the creature has:

- **Not Allowed** (the default): the use stops.
- **Allowed**: the player confirms first. Then the creature spends or sacrifices what it has.
- **Half Max HP Damage**: as Allowed, and the creature also takes damage equal to half its max HP.

The **Amount** can be a number, a formula such as `@level`, or a roll such as `1d4`. A roll is rolled at each use.

**Example: Supercharge.** Spend 1 mana or more, up to your WIL.

- **Resource** → `Mana`
- **Spend mode** → `Variable`
- **Minimum** → `1`
- **Maximum** → `@will`

The roll window asks for the amount. The amount starts at the minimum and stops at the maximum or at what the creature has, whichever is lower.

The card shows what the use took, such as **Cost: 3 Wounds (Enveloped by the Master)**. The damage and healing formulas of the item read it as `@cost.mana`, `@cost.hp`, `@cost.tempHp` and `@cost.wounds`. For example, `(@cost.mana)d8` rolls 1d8 for each mana spent.

::: details Edge cases
- A Temp HP cost spends only temp HP, never HP.
- A sacrifice of HP is not damage: armor, damage triggers and Concentration checks do not apply.
- With Allowed, mana, temp HP and HP go down to 0, never below. Every Wound applies, also past the maximum, and the usual death rules follow. On **Cancel**, the use stops and nothing is spent.
- Half Max HP Damage has the same consequences as Casting Beyond the Pool on a class.
- The check uses the lowest result of a rolled amount. With Not Allowed, a roll higher than the creature can cover stops the use, and nothing is spent. With a different choice, the player is asked after the roll.
- A variable amount stops at what the creature has. Only a minimum above it asks to use beyond what the creature has.
- A variable HP amount stops at current HP minus 1. When the creature cannot cover the minimum, the use stops before the roll window opens.
- The consequence applies after the item's own cost, such as the mana of a spell. When that cost stops the use, there is no consequence.
- The roll window says what the use costs, such as "When you roll, it spends 2 Mana and you sacrifice 5 HP."
- `@spent` stays the charges of a Charge Consumer.
- With the **Costs** automation setting off, nothing is checked or spent. A variable cost still asks for the amount, a roll is still rolled, the formulas still read the amount, and the card still shows the cost lines.
:::
