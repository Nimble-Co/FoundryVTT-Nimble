**Example: Coordinated Strike!** The Commander and an ally each make a weapon attack or cast a cantrip, for free.

- **Label** → `Coordinated Strike`
- **When** → `When this item is used`
- **Also for the user** → on
- **Targets it reaches** → `1`
- **Weapon** → `Any weapon`
- **Cantrips too** → on
- **Free** → on

When the Commander uses the feature with an ally targeted, its card gets a line for the Commander and one for the ally. Each line has a weapon dropdown and an **Attack** button. The attack is made through the feature, so a rule with **Only attacks made through** set to `coordinated-strike` applies to it, and to no other attack.

**Example: Quickstrike.** When the Zephyr Interposes, they can first make an Unarmed Strike for free.

- **When** → `When its owner Interposes`
- **Weapon** → `An Unarmed Strike`
- **Free** → on

The line goes on the card of the attack that the Zephyr Interposes against. When that card is a whisper, or when there is no attack card, it goes on the Interpose card.

**Example: Swiftstrike.** The Zephyr spends 1 Burst of Speed to attack for free, with no disadvantage from Rushed Attacks.

- **Label** → `Swiftstrike`
- **When** → `When this item is used`
- **Also for the user** → on
- **For the targets** → off
- **Weapon** → `Any weapon`
- **Free** → on
- **Ignores Rushed Attacks** → on

The line is only for the Zephyr, even when an enemy is targeted. An Extra Targets rule for attacks made through the item lets the attack of the line hit more creatures with one roll.

**Example: Into the Fray.** The Berserker leaps, then attacks for free if they land next to at least 2 enemies.

- **When** → `When the user's move from this item ends`
- **Weapon** → `Any weapon`
- **Free** → on
- **Condition** → `If you land adjacent to at least 2 enemies, make an attack against 1 of them for free.`
- **Check at the end of the move** → `Adjacent to enough enemies`
- **Enemies** → `2`

The item's card also has a Move node for the user. The line is only for the user, and shows once the move from the card ends, whether the user made it or moved another way. With **Movement Count** or **Pushes, Pulls and Moves for Free** off, it shows at once. Where the check fails at the end of the move, the line shows a warning, and the **Attack** button stays. The other checks are `Adjacent to a marked creature` (name the **Mark**, such as `quarry`, as the Mark Target rule writes it; with no Mark, the card makes no check) and `Adjacent to a creature with a condition` (pick the condition).

**Needs an empty pool** names a charge pool. When the item is used while that pool has charges, a warning shows and the use goes on. Roll & Strike uses it for Thrill of the Hunt.

**Example: No Escape.** When an ally makes an opportunity attack, the Hunter can make a ranged opportunity attack against the same target.

- **When** → `When an ally of its owner makes an opportunity attack`
- **Weapon** → `A ranged weapon`
- **Opportunity attack** → on
- **Condition** → `Against the same target.`

The card of the ally's opportunity attack gets a "Ranged Opportunity Attack" line for each ally in the combat with the rule. Shield Expert uses **When its owner's Defend blocks all the damage of an attack**, with **Free** and **Opportunity attack** both on and a hidden Charge Pool as **Charge pool**, so the line comes once each round and spends nothing. Opportunistic Frenzy uses **When a Movement Trigger rule of this item posts its card**: the line goes on that card in place of its use button.

**Free** spends no action. **Opportunity attack** makes the attack an opportunity attack: it starts at disadvantage and spends the Opportunity Attack reaction in place of an action, after the attack. With **Free** on too, it spends no reaction. With neither, the attack spends an action as usual.

**Charge pool** limits the rule: it puts lines on a card only while the pool has a charge, and each card it puts lines on spends 1 charge, whether the line is used or not.

A free attack still counts as an attack of the turn, so it takes Rushed Attack disadvantage and adds to the count. **Ignores Rushed Attacks** removes only that disadvantage. The attack still counts.

**Targets it reaches** is reported, not enforced. With 2 allies targeted for Coordinated Strike!, both get a line, and the card says "Coordinated Strike reaches 1 creature. 2 are targeted." The table picks who attacks. A Grant Activation Targets rule raises the count.

**Condition** is text under the line's label, for a condition the table checks, such as "If you end adjacent to your quarry". The player can use the line either way, also when a check warns.
