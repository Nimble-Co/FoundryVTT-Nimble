**Example: Coordinated Strike!** The Commander and an ally each make a weapon attack or cast a cantrip, for free.

- **When** → `When this item is used`
- **Also for the user** → on
- **Targets it reaches** → `1`
- **Weapon** → `Any weapon`
- **Cantrips too** → on
- **Free** → on

The card of the feature gets a line for the Commander and one for the targeted ally. The attack is made through the feature, so a rule with **Only attacks made through** set to `coordinated-strike` applies to it and to no other attack. With 2 allies targeted, both get a line and the card shows a warning. The table picks who attacks.

**Example: Into the Fray.** The Berserker leaps, then attacks for free when they land next to 2 or more enemies.

- **When** → `When the user's move from this item ends`
- **Weapon** → `Any weapon`
- **Free** → on
- **Check at the end of the move** → `Adjacent to enough enemies`
- **Enemies** → `2`

The item's card also has a Move node for the user. The line shows when that move ends, or at once with **Movement Count** or **Pushes, Pulls and Moves for Free** off. When the check fails, the line shows a warning and the **Attack** button stays.

::: details Reactions, opportunity attacks and limits
- **On Interpose**, the line goes on the attack card. When that card is a whisper, or there is no attack card, it goes on the Interpose card.
- **On an ally's opportunity attack**, each ally in the combat with the rule gets a line on that attack's card.
- **On its Movement Trigger**, the line goes on the card that the Movement Trigger rule posts, in place of its use button.
- **Opportunity attack** with **Free** on spends no reaction. With neither on, the attack spends an action.
- **Charge pool** set to a hidden pool of 1 that refills at the start of the owner's turn gives a line once each round. A card spends the charge whether the line is used or not.
- **Needs an empty pool** only warns. The use goes on.
- **Condition** is text for the table. The player can use the line either way.
- A free attack still counts as an attack of the turn. **Ignores Rushed Attacks** removes only the disadvantage.
- A Grant Activation Targets rule raises **Targets it reaches**. An Extra Targets rule for attacks made through the item lets one attack hit more creatures.
:::
