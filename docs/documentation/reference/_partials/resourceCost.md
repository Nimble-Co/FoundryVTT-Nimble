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

The roll window says what the use costs, for example "When you roll, it spends 2 Mana and you sacrifice 5 HP." The chat card has a line for each cost under its title, such as **Cost: 3 mana (Storm Wake)**.

With the **Costs** automation setting off, nothing is checked or spent, and the card still shows the cost lines.
