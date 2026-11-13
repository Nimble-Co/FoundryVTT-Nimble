The Attacker Takes rule (type `damageBack`) puts damage, an effect, or both on the one who attacks the owner. A line on the attack card tells it.

**When** picks the moment:

- **The owner takes damage from an attack:** when the damage of the card is applied. The amount can be what the owner took after armor and reductions, or what the attack's crit dice came to. **Only against crits** limits it to crits.
- **The owner is attacked:** when the attack card is made, also on a miss. Each attacker of the card gets it, each member of a minion group too. Use **A formula** for the damage: no damage was taken yet.

**Attacks** limits it to melee or ranged attacks. A monster attack with no attack type is melee. **Not on allies** leaves out an attacker on the owner's side (token disposition). The owner is never its own attacker. A card read twice makes one line.

**A formula** rolls its dice for each attacker, with a **Damage type**. **Ignore armor** is on by default; off, the attacker's armor, resistances, immunities and reductions apply. **Effect on the attacker** is an effect of the item (Apply to the actor off) that goes on each attacker. **A Wound doubles it** puts a button on the card: the owner or the GM can suffer 1 Wound to deal the amount one more time.

With **Feature Effects** off, nothing goes on the attacker by itself. The line has a **Deal** or **Apply** button.

::: details The attack a reaction answers
A reaction spell cast from its row in the Defend window answers that attack. When its effect has a rule with **Also the attack it answers** on, the attack it answers counts too. Cast from the sheet, the effect counts only later attacks.
:::

**Example: Bring the Pain.** Whenever you are crit, reduce the damage by half. The attacker takes the same amount of damage you took (ignoring armor). You may suffer 1 Wound to double the damage the enemy takes.

- A **Damage Reduction** rule: **Mode** → `Half`, **Only against crits** → on
- An **Attacker Takes** rule: **Only against crits** → on, **A Wound doubles it** → on

**Example: Flame Barrier.** Until the start of your next turn, melee attackers against you take KEY damage (ignoring armor) and gain Smoldering.

- On the spell's effect: an **Attacker Takes** rule: **When** → `The owner is attacked`, **Attacks** → `Melee`, **Not on allies** → on, **Also the attack it answers** → on, **Amount** → `A formula`, **Damage** → `@key`, **Damage type** → `Fire`, **Effect on the attacker** → the Smoldering effect

**Example: Spines.** Melee attackers take 3 damage.

- On the monster feature: an **Attacker Takes** rule: **When** → `The owner is attacked`, **Attacks** → `Melee`, **Amount** → `A formula`, **Damage** → `3`
